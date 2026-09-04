/**
 * StockAllocationService — decides, when several pending sales_order
 * documents want more of a product/variant at a warehouse than is
 * actually on hand, who gets served first. This is a genuinely different
 * problem from salesOrderService.fulfillPartially() (which handles ONE
 * order's own shortfall against real stock) — this is the fairness/
 * priority question across MULTIPLE orders competing for the same limited
 * pool. It reuses fulfillPartially for the actual invoicing/backorder-split
 * mechanics rather than duplicating them: this service's job is entirely
 * the ranking and per-order quantity cap, one order at a time, draining a
 * shared pool as it goes.
 */
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const inventoryService = require('./inventoryService');
const salesOrderService = require('./salesOrderService');

const RULES = {
  // Highest Customer.allocationPriority first, then oldest order first
  // (FIFO) as the tiebreaker — the sensible default: a company's key
  // accounts get served first, and among equal-priority customers,
  // whoever ordered first waits least.
  priority_then_fifo: (a, b) => (b.priority - a.priority) || (a.sale.createdAt - b.sale.createdAt),
  // Plain first-come-first-served, ignoring customer priority entirely —
  // for a company that deliberately wants "no favorites".
  fifo: (a, b) => a.sale.createdAt - b.sale.createdAt,
  // Largest order value first — clears the biggest commitments before
  // spreading remaining stock across smaller ones.
  order_value_desc: (a, b) => b.sale.totalAmount - a.sale.totalAmount,
};

/**
 * Builds the allocation plan for one product/variant/warehouse: every
 * pending (quotation-excluded — only real sales_order documents compete
 * for real stock) order with an unfulfilled line for this item, ranked by
 * `rule`, each capped by whatever's left in the shared on-hand pool after
 * higher-ranked orders take their share. Read-only — does not fulfill or
 * invoice anything; see applyAllocation() for that.
 */
async function buildAllocationPlan(companyId, { productId, variantId, warehouseId, rule = 'priority_then_fifo' } = {}) {
  const rankFn = RULES[rule] || RULES.priority_then_fifo;

  const onHand = await inventoryService.getStockLevel(warehouseId, variantId, null);

  const candidateSales = await Sale.find({
    companyId, warehouseId, status: 'sales_order',
    'items.variantId': variantId,
  });

  const entries = [];
  for (const sale of candidateSales) {
    const line = sale.items.find((i) => String(i.variantId) === String(variantId) && String(i.productId) === String(productId));
    if (!line) continue;
    const customer = sale.customerId ? await Customer.findById(sale.customerId).select('allocationPriority name') : null;
    entries.push({
      sale, requestedQuantity: line.quantity,
      priority: customer?.allocationPriority || 0,
      customerName: customer?.name || null,
    });
  }

  entries.sort(rankFn);

  let remaining = onHand;
  const plan = [];
  for (const entry of entries) {
    const allocated = Math.max(Math.min(entry.requestedQuantity, remaining), 0);
    remaining -= allocated;
    plan.push({
      saleId: entry.sale._id, documentNumber: entry.sale.documentNumber,
      customerName: entry.customerName, priority: entry.priority,
      requestedQuantity: entry.requestedQuantity,
      allocatedQuantity: allocated,
      shortfall: entry.requestedQuantity - allocated,
    });
  }

  return { productId, variantId, warehouseId, onHand, rule, plan };
}

/**
 * Executes a previously-built plan: walks it in the same order and calls
 * fulfillPartially() per order with exactly the planned quantity for this
 * line (any other lines on the same order fall back to fulfillPartially's
 * own "whatever's on hand" default, since allocation rules here are scoped
 * to this one product/variant). Orders are processed sequentially — each
 * one's fulfillPartially call consumes real stock, so processing strictly
 * in rank order is what makes the plan's ranking actually stick.
 */
async function applyAllocation(companyId, { productId, variantId, warehouseId, rule } = {}) {
  const { plan } = await buildAllocationPlan(companyId, { productId, variantId, warehouseId, rule });
  const results = [];
  for (const entry of plan) {
    if (entry.allocatedQuantity <= 0) {
      results.push({ saleId: entry.saleId, skipped: true, reason: 'No stock left to allocate to this order.' });
      continue;
    }
    const outcome = await salesOrderService.fulfillPartially(entry.saleId, {
      warehouseId,
      itemFulfillments: [{ variantId, batchId: null, quantity: entry.allocatedQuantity }],
    });
    results.push({ saleId: entry.saleId, ...outcome });
  }
  return results;
}

module.exports = { buildAllocationPlan, applyAllocation, RULES: Object.keys(RULES) };
