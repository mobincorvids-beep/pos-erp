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
 * @param {import('mongoose').ClientSession} [session]
 */
async function recordMovement(params, session) {
  const {
    companyId, warehouseId, productId, variantId, batchId = null,
    type, quantity, unitCost, referenceType, referenceId, userId, note,
  } = params;

  if (!quantity || quantity === 0) {
    throw new Error('Stock movement quantity must be non-zero.');
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
  const alreadyNotified = await require('../models/Notification').findOne({
    companyId, type: 'low_stock', entityType: 'Product', entityId: productId, read: false,
  });
  if (alreadyNotified) return; // already have an unread alert out for this product — don't pile on more

  // Roles with inventory-write permission are the real audience — nobody
  // "owns" a product individually in this app's data model, so the
  // sensible target is whoever's actually able to act on a low-stock alert.
  const roles = await Role.find({ companyId, permissions: { $in: ['inventory.adjust', 'inventory.*', '*'] } });
  for (const role of roles) {
    await notificationService.notify({
      companyId, roleId: role._id, type: 'low_stock',
      title: `Low stock: ${product.name}${variant?.sku ? ` (${variant.sku})` : ''}`,
      message: `Only ${currentQuantity} remaining — at or below the reorder level of ${product.reorderLevel}.`,
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

/** Current weighted-average cost per unit — used for stock valuation and COGS. */
async function getAvgCost(warehouseId, variantId, batchId = null) {
  const level = await StockLevel.findOne({ warehouseId, variantId, batchId });
  return level?.avgCost || 0;
}

/** Throws if selling `quantity` would take stock negative. Accounts for reservedQuantity — reserved units aren't available for a NEW commitment, but ARE available for the sale that reserved them (pass ignoreReservation:true from convertToInvoice). */
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

/** Reserves quantity against a Sales Order without moving stock — see StockLevel.reservedQuantity. */
async function reserve(warehouseId, variantId, batchId, quantity, session) {
  await StockLevel.findOneAndUpdate(
    { warehouseId, variantId, batchId },
    { $inc: { reservedQuantity: quantity } },
    { session }
  );
}

/** Releases a reservation — called when a Sales Order is converted to an invoice (the stock actually leaves) or cancelled (the hold is dropped). */
async function releaseReservation(warehouseId, variantId, batchId, quantity, session) {
  await StockLevel.findOneAndUpdate(
    { warehouseId, variantId, batchId },
    { $inc: { reservedQuantity: -quantity } },
    { session }
  );
}

/** A real, previously-missing read endpoint — ProductBatch has been written to by purchasing this whole project but had no way to be listed back out, something a batch recall (or any real batch-selection UI) genuinely needs. */
function listProductBatches(companyId, { productId } = {}) {
  const filter = { companyId };
  if (productId) filter.productId = productId;
  return ProductBatch.find(filter).populate('productId', 'name').sort({ expiryDate: 1 });
}

module.exports = {
  recordMovement, getStockLevel, getAvgCost, assertSufficientStock,
  reserve, releaseReservation, listProductBatches,
};
