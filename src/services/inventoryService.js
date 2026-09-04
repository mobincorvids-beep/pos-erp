/**
 * InventoryService — single point of truth for all stock changes.
 *
 * Every module (POS, purchasing, transfers, manufacturing) MUST go through
 * recordMovement() rather than touching StockLevel directly. This keeps the
 * immutable stockMovements ledger and the stockLevels cache always in sync,
 * and gives every industry (batch/expiry, serial, weight, simple) one
 * consistent audit trail.
 *
 * Costing: weighted-average. Every incoming movement that carries a
 * unitCost (purchase, production_output) recomputes StockLevel.avgCost as
 * (existingValue + incomingValue) / (existingQty + incomingQty). Outgoing
 * movements (sale, transfer_out, etc.) don't change avgCost — they consume
 * stock at whatever the current average is. This is what stockValuation()
 * and the COGS posting in posSaleService/salesOrderService read from,
 * instead of falling back to Product.costPrice.
 */
const StockLevel = require('../models/StockLevel');
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const ProductBatch = require('../models/ProductBatch');
const Role = require('../models/Role');
const notificationService = require('./notificationService');
const warehouseZoneService = require('./warehouseZoneService');

// 'adjustment' is included so an opening-stock or stock-count adjustment
// that carries an explicit unitCost (e.g. "I'm entering 100 units at cost
// PKR 40 each") establishes a real cost basis — without this, any stock
// that entered the system via adjustment rather than a Purchase/GRN would
// have avgCost permanently stuck at 0, silently zeroing out COGS and
// margin reporting for that stock forever, even after real sales. An
// adjustment with no unitCost (e.g. a shrinkage correction) is unaffected
// — isCostedIncoming below still requires unitCost to be explicitly set.
const COSTED_INCOMING_TYPES = ['purchase', 'production_output', 'adjustment'];

/**
 * @param {Object} params
 * @param {String} params.companyId
 * @param {String} params.warehouseId
 * @param {String} params.productId
 * @param {String} params.variantId
 * @param {String} [params.batchId]
 * @param {String} params.type - sale | sale_return | purchase | transfer_in | transfer_out | adjustment | production_consume | production_output | qc_reject | void | damage
 * @param {Number} params.quantity - positive = stock in, negative = stock out
 * @param {Number} [params.unitCost]
 * @param {String} [params.referenceType]
 * @param {String} [params.referenceId]
 * @param {String} [params.userId]
 * @param {String} [params.note]
 * @param {String} [params.binId] - when the caller already knows which bin the
 *   units are moving into/out of (GRN putaway, a bin-aware pick), BinStock is
 *   nudged by exactly this movement at that bin. When omitted on an outgoing
 *   movement, an existing bin breakdown for this product/warehouse (if any)
 *   is drawn down automatically (see warehouseZoneService.planBinConsumption)
 *   so BinStock keeps tracking reality across every stock-decreasing path —
 *   sale, transfer, manufacturing consumption, adjustment — not only the
 *   ones that remembered to call assignStockToBin/moveBinStock directly.
 * @param {import('mongoose').ClientSession} [session]
 */
async function recordMovement(params, session) {
  const {
    companyId, warehouseId, productId, variantId, batchId = null,
    type, quantity, unitCost, referenceType, referenceId, userId, note, binId,
  } = params;

  if (!quantity || quantity === 0) {
    throw new Error('Stock movement quantity must be non-zero.');
  }

  // Centralized negative-stock guard. This used to live only in the
  // separate assertSufficientStock() export, which meant it only protected
  // whichever callers remembered to call it BEFORE recordMovement (POS
  // checkout, transfers, manufacturing consumption, sales orders, service
  // jobs, maintenance parts all did) — any write path that skipped it
  // could silently take StockLevel.quantity negative. recordMovement() is
  // the one function every module actually goes through to mutate stock
  // (see the module header comment), so the guard now lives here instead,
  // as the last line of defense for every caller, not just the careful
  // ones. 'adjustment' is exempt: a stocktake reconciliation
  // (stockCountService.submitCount) authoritatively SETS the true physical
  // count via a variance movement, including a negative variance that
  // corrects a previously-wrong balance — that's the mechanism for fixing
  // a bad StockLevel, so it can't be blocked by the same check it exists
  // to correct. assertSufficientStock() itself is left in place and
  // unchanged (it also accounts for reservedQuantity, which this raw
  // on-hand check deliberately does not) — callers that need the
  // reservation-aware pre-check should keep calling it for an earlier,
  // friendlier error, but this is now the guarantee, not just their
  // sole line of defense.
  if (quantity < 0 && type !== 'adjustment') {
    const level = await StockLevel.findOne({ warehouseId, variantId, batchId }).session(session || null);
    const onHand = level?.quantity || 0;
    if (onHand + quantity < 0) {
      throw new Error(
        `Insufficient stock: requested ${-quantity}, available ${onHand} (warehouse ${warehouseId}, variant ${variantId}${batchId ? `, batch ${batchId}` : ''}).`
      );
    }
  }

  const [movement] = await StockMovement.create(
    [{
      companyId, warehouseId, productId, variantId, batchId,
      type, quantity, unitCost, referenceType, referenceId, userId, note,
    }],
    { session }
  );

  const isCostedIncoming = quantity > 0 && COSTED_INCOMING_TYPES.includes(type) && unitCost !== undefined && unitCost !== null;

  if (isCostedIncoming) {
    // Weighted-average recompute needs the pre-update quantity/cost, so this
    // can't be a single atomic $inc — read, compute, write, inside the
    // caller's transaction (session) so it's still consistent.
    const existing = await StockLevel.findOne({ warehouseId, variantId, batchId }).session(session || null);
    const existingQty = existing?.quantity || 0;
    const existingAvgCost = existing?.avgCost || 0;
    const newQty = existingQty + quantity;
    const newAvgCost = newQty > 0
      ? ((existingQty * existingAvgCost) + (quantity * unitCost)) / newQty
      : 0;

    await StockLevel.findOneAndUpdate(
      { warehouseId, variantId, batchId },
      { quantity: newQty, avgCost: newAvgCost, $setOnInsert: { companyId, productId } },
      { upsert: true, session }
    );
  } else {
    await StockLevel.findOneAndUpdate(
      { warehouseId, variantId, batchId },
      { $inc: { quantity }, $setOnInsert: { companyId, productId, avgCost: 0 } },
      { upsert: true, session }
    );
  }

  // BinStock sync — see the binId param doc above. Best-effort and never
  // allowed to fail the movement itself: a bin-location breakdown that's
  // briefly stale is a real but recoverable problem, same posture as the
  // low-stock notification check just below.
  try {
    if (quantity > 0 && binId) {
      await warehouseZoneService.adjustBinStock({ binId, productId, quantity, companyId, warehouseId }, session);
    } else if (quantity < 0) {
      if (binId) {
        await warehouseZoneService.adjustBinStock({ binId, productId, quantity, companyId, warehouseId }, session);
      } else {
        const plan = await warehouseZoneService.planBinConsumption(warehouseId, productId, -quantity, session);
        for (const step of plan) {
          await warehouseZoneService.adjustBinStock({ binId: step.binId, productId, quantity: -step.quantity, companyId, warehouseId }, session);
        }
      }
    }
  } catch (err) {
    console.error('BinStock sync failed (stock movement itself still succeeded):', err.message);
  }

  // Consignment liability recognition — best-effort, same posture as the
  // BinStock sync above: any stock consumed here MIGHT be consignment
  // stock (most won't be — consumeConsignmentStock() is a no-op read when
  // there's nothing outstanding for this product/warehouse). Only makes
  // sense on a genuine decrease (a sale/consumption), never on receipt —
  // consignment goods going ON-hand is handled directly by
  // purchaseService.receiveGoods() opening the ConsignmentStock row.
  if (quantity < 0) {
    try {
      const consignmentService = require('./consignmentService');
      await consignmentService.consumeConsignmentStock(
        companyId, warehouseId, productId, variantId, -quantity,
        { referenceType, referenceId, userId, session }
      );
    } catch (err) {
      console.error('Consignment liability recognition failed (stock movement itself still succeeded):', err.message);
    }
  }

  // Only worth checking when stock just went DOWN — a low-stock condition
  // can only newly arise from a decreasing movement, never an incoming one.
  // Wrapped so a notification failure can never break the actual stock
  // movement, which is the operation that actually matters here — a
  // missed alert is a real but recoverable problem; a failed sale isn't.
  if (quantity < 0) {
    try {
      await checkLowStockAndNotify({ companyId, warehouseId, productId, variantId, session });
    } catch (err) {
      console.error('Low-stock notification check failed (stock movement itself still succeeded):', err.message);
    }
  }

  return movement;
}

/**
 * The actual Notification Engine trigger point for low stock — real, not
 * decorative. Fires only when the resulting quantity is at-or-below
 * Product.reorderLevel (0 means no threshold configured, so skip
 * entirely), and DEDUPES against an already-unread low-stock notification
 * for this exact product+variant+warehouse — otherwise every single sale
 * of an already-low item would spam a fresh notification, drowning out
 * the one that actually mattered.
 */
async function checkLowStockAndNotify({ companyId, warehouseId, productId, variantId, session }) {
  const product = await Product.findById(productId).session(session || null);
  if (!product || !product.reorderLevel || product.reorderLevel <= 0) return; // no threshold configured — nothing to check against

  const level = await StockLevel.findOne({ warehouseId, variantId }).session(session || null);
  const currentQuantity = level?.quantity || 0;
  if (currentQuantity > product.reorderLevel) return; // still above threshold — nothing to notify about

  const variant = product.variants?.id(variantId);

  // Roles with inventory-write permission are the real audience — nobody
  // "owns" a product individually in this app's data model, so the
  // sensible target is whoever's actually able to act on a low-stock alert.
  const roles = await Role.find({ companyId, permissions: { $in: ['inventory.adjust', 'inventory.*', '*'] } });

  // notificationService.notify() upserts (rather than plain-creates) any
  // type: 'low_stock' notification against Notification's partial unique
  // index — see that function's header comment for why: this write is
  // deliberately outside the caller's DB transaction/session (a
  // notification failure must never fail the sale/stock-movement it's
  // attached to), which means session.withTransaction() retrying its
  // callable several frames up can't roll this write back the way it
  // rolls back the transaction's own writes. The upsert makes a retried
  // attempt a no-op update of the same unread row instead of a duplicate.
  const title = `Low stock: ${product.name}${variant?.sku ? ` (${variant.sku})` : ''}`;
  const message = `Only ${currentQuantity} remaining, at or below the reorder level of ${product.reorderLevel}.`;
  for (const role of roles) {
    await notificationService.notify({
      companyId, roleId: role._id, type: 'low_stock', title, message,
      entityType: 'Product', entityId: productId,
    });
  }

  // Developer Platform outbound webhook — same "never let this block or
  // fail the real operation" rule as the in-app notification above.
  try {
    await require('./webhookSubscriptionService').triggerWebhook(String(companyId), 'product.low_stock', {
      productId, variantId, warehouseId, currentQuantity, reorderLevel: product.reorderLevel, productName: product.name,
    });
  } catch (err) {
    console.error('Developer Platform webhook delivery for product.low_stock failed:', err.message);
  }
}

/** Current on-hand quantity for a variant at a warehouse (optionally a specific batch). */
async function getStockLevel(warehouseId, variantId, batchId = null) {
  const level = await StockLevel.findOne({ warehouseId, variantId, batchId });
  return level ? level.quantity : 0;
}

/** Current weighted-average cost per unit, used for stock valuation and COGS. */
async function getAvgCost(warehouseId, variantId, batchId = null) {
  const level = await StockLevel.findOne({ warehouseId, variantId, batchId });
  return level?.avgCost || 0;
}

/** Throws if selling `quantity` would take stock negative. Accounts for reservedQuantity, reserved units aren't available for a NEW commitment, but ARE available for the sale that reserved them (pass ignoreReservation:true from convertToInvoice). */
async function assertSufficientStock(warehouseId, variantId, batchId, quantity, { ignoreReservation = false } = {}) {
  const level = await StockLevel.findOne({ warehouseId, variantId, batchId });
  const onHand = level?.quantity || 0;
  const reserved = ignoreReservation ? 0 : (level?.reservedQuantity || 0);
  const available = onHand - reserved;
  if (available < quantity) {
    throw new Error(
      `Insufficient stock: requested ${quantity}, available ${available} (on hand ${onHand}, reserved ${reserved}).`
    );
  }
}

/** Reserves quantity against a Sales Order without moving stock, see StockLevel.reservedQuantity. */
async function reserve(warehouseId, variantId, batchId, quantity, session) {
  await StockLevel.findOneAndUpdate(
    { warehouseId, variantId, batchId },
    { $inc: { reservedQuantity: quantity } },
    { session }
  );
}

/** Releases a reservation: called when a Sales Order is converted to an invoice (the stock actually leaves) or cancelled (the hold is dropped). */
async function releaseReservation(warehouseId, variantId, batchId, quantity, session) {
  await StockLevel.findOneAndUpdate(
    { warehouseId, variantId, batchId },
    { $inc: { reservedQuantity: -quantity } },
    { session }
  );
}

/** A real, previously-missing read endpoint, ProductBatch has been written to by purchasing this whole project but had no way to be listed back out, something a batch recall (or any real batch-selection UI) genuinely needs. */
function listProductBatches(companyId, { productId } = {}) {
  const filter = { companyId };
  if (productId) filter.productId = productId;
  return ProductBatch.find(filter).populate('productId', 'name').sort({ expiryDate: 1 });
}

/**
 * FEFO (First-Expiry-First-Out) batch picker source: every batch for this
 * variant that actually has sellable stock (quantity > 0) at the given
 * warehouse, sorted earliest-expiry-first — batches with no expiryDate
 * sort last, since there's nothing to prioritize them against. Used by the
 * POS checkout batch/lot picker (client/src/pages/PosPage.jsx) so a
 * cashier is never offered an empty or already-expired-by-policy batch.
 */
async function listAvailableBatches(warehouseId, variantId) {
  const levels = await StockLevel.find({ warehouseId, variantId, quantity: { $gt: 0 }, batchId: { $ne: null } }).lean();
  if (levels.length === 0) return [];

  const qtyByBatch = new Map(levels.map((l) => [String(l.batchId), l.quantity]));
  const batches = await ProductBatch.find({ _id: { $in: [...qtyByBatch.keys()] } }).lean();

  return batches
    .map((b) => ({ ...b, availableQuantity: qtyByBatch.get(String(b._id)) || 0 }))
    .sort((a, b) => {
      if (!a.expiryDate && !b.expiryDate) return 0;
      if (!a.expiryDate) return 1;
      if (!b.expiryDate) return -1;
      return new Date(a.expiryDate) - new Date(b.expiryDate);
    });
}

module.exports = {
  recordMovement, getStockLevel, getAvgCost, assertSufficientStock,
  reserve, releaseReservation, listProductBatches, listAvailableBatches,
};
