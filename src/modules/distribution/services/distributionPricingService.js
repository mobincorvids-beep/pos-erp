/**
 * DistributionPricingService — quantity-break pricing and the wholesale
 * order flow. computePrice() and quoteOrder() are pure quoting functions
 * (no writes); quoteAndCreateSalesOrder() is the actual interlink point —
 * unlike every prior industry module (which billed straight through
 * posSaleService.checkout()), a wholesale order is a commitment to fulfill
 * later, not an instant sale, so this reuses the EARLIER core Sales Orders
 * module (salesOrderService.createSalesOrder) instead of checkout — the
 * first industry module to interlink with that layer rather than checkout directly.
 */
const Product = require('../../../models/Product');
const PriceTierSchedule = require('../models/PriceTierSchedule');
const salesOrderService = require('../../../services/salesOrderService');

function setSchedule(input) {
  const { companyId, productId, variantId, minimumOrderQuantity, tiers } = input;
  if (!tiers || tiers.length === 0) throw new Error('At least one tier is required.');
  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  return PriceTierSchedule.findOneAndUpdate(
    { variantId },
    { companyId, productId, variantId, minimumOrderQuantity: minimumOrderQuantity || 1, tiers: sorted },
    { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

function getSchedule(variantId) {
  return PriceTierSchedule.findOne({ variantId });
}

/** All configured schedules for this company — the UI's way to browse without knowing a variantId up front, same gap class fixed in Hotel/Banquet. */
function listSchedules(companyId) {
  return PriceTierSchedule.find({ companyId }).populate('productId', 'name');
}

/**
 * The unit price for buying `quantity` of this variant — the highest tier
 * whose minQuantity is <= quantity, or the product's normal sellingPrice
 * if no schedule exists (a variant with no tiers configured just behaves
 * like an ordinary product, not an error).
 */
async function computePrice(companyId, variantId, quantity) {
  const schedule = await PriceTierSchedule.findOne({ companyId, variantId });
  if (!schedule) {
    const product = await Product.findOne({ companyId, 'variants._id': variantId });
    const variant = product?.variants?.id(variantId);
    return { unitPrice: variant?.sellingPrice ?? product?.sellingPrice ?? 0, tierApplied: null, minimumOrderQuantity: 1 };
  }

  if (quantity < schedule.minimumOrderQuantity) {
    throw new Error(`Minimum order quantity for this item is ${schedule.minimumOrderQuantity}, requested ${quantity}.`);
  }

  // Tiers are stored sorted ascending — walk from the end to find the
  // highest threshold the quantity qualifies for.
  let applicable = null;
  for (let i = schedule.tiers.length - 1; i >= 0; i--) {
    if (quantity >= schedule.tiers[i].minQuantity) { applicable = schedule.tiers[i]; break; }
  }
  if (!applicable) throw new Error(`Quantity ${quantity} does not meet any configured price tier (lowest tier starts at ${schedule.tiers[0].minQuantity}).`);

  return { unitPrice: applicable.unitPrice, tierApplied: applicable.minQuantity, minimumOrderQuantity: schedule.minimumOrderQuantity };
}

/** Quotes a whole order — computes each line's tiered unit price, doesn't write anything. */
async function quoteOrder(companyId, items) {
  const quoted = [];
  for (const item of items) {
    const price = await computePrice(companyId, item.variantId, item.quantity);
    quoted.push({
      productId: item.productId, variantId: item.variantId, quantity: item.quantity,
      unitPrice: price.unitPrice, tierApplied: price.tierApplied, lineTotal: Math.round(price.unitPrice * item.quantity * 100) / 100,
    });
  }
  return quoted;
}

/**
 * Quotes the order, then creates a real Sales Order through the CORE
 * salesOrderService — not checkout. A wholesale buyer's order is a
 * commitment (reserves stock, doesn't move it yet), fulfilled and invoiced
 * later exactly like any other sales order in the system; this module adds
 * nothing to that fulfillment step, only to how the order's prices got computed.
 */
async function quoteAndCreateSalesOrder(input) {
  const { companyId, branchId, warehouseId, customerId, userId, items, validUntil } = input;
  const quotedItems = await quoteOrder(companyId, items);
  return salesOrderService.createSalesOrder({
    companyId, branchId, warehouseId, customerId, userId, validUntil,
    items: quotedItems.map((q) => ({ productId: q.productId, variantId: q.variantId, quantity: q.quantity, unitPrice: q.unitPrice })),
  });
}

module.exports = { setSchedule, getSchedule, listSchedules, computePrice, quoteOrder, quoteAndCreateSalesOrder };
