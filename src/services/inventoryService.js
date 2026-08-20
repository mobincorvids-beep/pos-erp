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

const COSTED_INCOMING_TYPES = ['purchase', 'production_output'];

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

  return movement;
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

module.exports = {
  recordMovement, getStockLevel, getAvgCost, assertSufficientStock,
  reserve, releaseReservation,
};
