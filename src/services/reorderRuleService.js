/**
 * ReorderRuleService — per-warehouse min/max replenishment overrides on top
 * of Product.reorderLevel (the existing, global, one-per-product default
 * that inventoryService's low-stock notifications and mrpService's
 * includeReorderLevel demand already read). A ReorderRule for a given
 * warehouse+product wins over the product-level default; a product with no
 * rule at a given warehouse still falls back to Product.reorderLevel
 * exactly as before — nothing existing breaks.
 */
const ReorderRule = require('../models/ReorderRule');
const Product = require('../models/Product');
const StockLevel = require('../models/StockLevel');
const StockMovement = require('../models/StockMovement');
const PurchaseOrder = require('../models/PurchaseOrder');
const Supplier = require('../models/Supplier');

// Window used to estimate an average daily usage rate from recent sales
// movements. 30 days is a reasonable default trade-off between reacting to
// recent demand shifts and smoothing out single-day noise.
const USAGE_LOOKBACK_DAYS = 30;

// PO statuses that count as "already in flight" — a PO that's still going
// to deliver more stock, so a fresh reorder trigger would be redundant.
// 'received' and 'cancelled' are deliberately excluded.
const IN_FLIGHT_PO_STATUSES = ['draft', 'ordered', 'partially_received'];

function upsertRule({ companyId, warehouseId, productId, minQty, maxQty, isActive }) {
  if (minQty == null || minQty < 0) throw new Error('minQty must be a non-negative number.');
  if (maxQty != null && maxQty < minQty) throw new Error('maxQty must be greater than or equal to minQty.');
  return ReorderRule.findOneAndUpdate(
    { warehouseId, productId },
    { companyId, warehouseId, productId, minQty, maxQty: maxQty ?? null, isActive: isActive !== false },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function listRules(companyId, { warehouseId } = {}) {
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  return ReorderRule.find(filter).populate('productId', 'name sku').sort({ createdAt: -1 });
}

async function deleteRule(id, companyId) {
  const rule = await ReorderRule.findOneAndDelete({ _id: id, companyId });
  if (!rule) throw new Error('Reorder rule not found.');
  return rule;
}

/**
 * Resolves the effective reorder point for a product at a warehouse: an
 * active ReorderRule for that exact warehouse+product wins; otherwise
 * falls back to Product.reorderLevel (0/absent = no threshold configured).
 * This is the single function both mrpService and the "below reorder
 * point" listing below should call, so the override/fallback logic lives
 * in exactly one place.
 */
async function resolveReorderPoint(companyId, warehouseId, productId) {
  const rule = await ReorderRule.findOne({ companyId, warehouseId, productId, isActive: true });
  if (rule) return { minQty: rule.minQty, maxQty: rule.maxQty ?? rule.minQty * 2, source: 'warehouse_rule' };

  const product = await Product.findById(productId).select('reorderLevel');
  const minQty = product?.reorderLevel || 0;
  return { minQty, maxQty: minQty * 2, source: 'product_default' };
}

/**
 * Everything at/below its effective reorder point (rule override, or the
 * product-level default) at one warehouse — the real "what needs
 * reordering here" view a warehouse manager actually wants, since a
 * company-wide low-stock list can't reflect per-warehouse min/max.
 */
async function listBelowReorderPoint(companyId, warehouseId) {
  const rules = await ReorderRule.find({ companyId, warehouseId, isActive: true }).populate('productId', 'name sku reorderLevel preferredSupplierId');
  const ruledProductIds = new Set(rules.map((r) => String(r.productId._id)));

  const results = [];

  for (const rule of rules) {
    if (!rule.productId) continue;
    const onHand = await sumOnHand(warehouseId, rule.productId._id);
    if (onHand <= rule.minQty) {
      const risk = await computeStockoutRisk(companyId, warehouseId, rule.productId._id, rule.productId.preferredSupplierId, onHand);
      results.push({
        productId: rule.productId._id, productName: rule.productId.name, sku: rule.productId.sku,
        onHand, minQty: rule.minQty, maxQty: rule.maxQty ?? rule.minQty * 2, source: 'warehouse_rule',
        ...risk,
      });
    }
  }

  // Products with no warehouse-specific rule still fall back to their
  // product-level default, same as inventoryService/mrpService.
  const defaultProducts = await Product.find({
    companyId, isActive: true, reorderLevel: { $gt: 0 }, _id: { $nin: [...ruledProductIds] },
  }).select('name sku reorderLevel preferredSupplierId');

  for (const product of defaultProducts) {
    const onHand = await sumOnHand(warehouseId, product._id);
    if (onHand <= product.reorderLevel) {
      const risk = await computeStockoutRisk(companyId, warehouseId, product._id, product.preferredSupplierId, onHand);
      results.push({
        productId: product._id, productName: product.name, sku: product.sku,
        onHand, minQty: product.reorderLevel, maxQty: product.reorderLevel * 2, source: 'product_default',
        ...risk,
      });
    }
  }

  return results.sort((a, b) => a.onHand - a.minQty - (b.onHand - b.minQty));
}

/**
 * Lead-time-aware enhancement layered on top of the plain min/max trigger
 * above (which already decided this product IS below reorder point — this
 * only adds urgency signal, it never gates inclusion/exclusion).
 *
 * - averageDailyUsage: mean daily quantity sold out of this warehouse over
 *   the last USAGE_LOOKBACK_DAYS (0 when there's no sales history yet, or
 *   when there's no on-hand at risk of running out at all).
 * - stockoutRiskDays: on-hand / averageDailyUsage — roughly how many days
 *   of stock remain at the current usage rate. null when usage is 0 (can't
 *   estimate a runout date from no recent movement).
 * - hasInFlightPurchaseOrder: whether a non-terminal PO already covers this
 *   product at this warehouse — if one exists, a fresh reorder trigger is
 *   redundant rather than urgent.
 * - supplierLeadTimeDays: the preferred supplier's leadTimeDays (0 if no
 *   preferred supplier or none set — "not tracked").
 * - stockoutRisk: 'critical' when the runway (stockoutRiskDays) is shorter
 *   than the supplier's lead time AND nothing is already in flight — this
 *   is the actual escalation signal on top of the existing "below reorder
 *   point" flag; 'covered' when a PO is already in flight; 'normal'
 *   otherwise (including whenever usage/lead-time data isn't available).
 */
async function computeStockoutRisk(companyId, warehouseId, productId, preferredSupplierId, onHand) {
  const since = new Date(Date.now() - USAGE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const movements = await StockMovement.find({
    companyId, warehouseId, productId, type: 'sale', createdAt: { $gte: since },
  }).select('quantity');
  const totalSold = movements.reduce((sum, m) => sum + Math.abs(m.quantity < 0 ? m.quantity : 0), 0);
  const averageDailyUsage = totalSold > 0 ? totalSold / USAGE_LOOKBACK_DAYS : 0;
  const stockoutRiskDays = averageDailyUsage > 0 ? onHand / averageDailyUsage : null;

  const hasInFlightPurchaseOrder = await PurchaseOrder.exists({
    companyId, warehouseId, status: { $in: IN_FLIGHT_PO_STATUSES }, 'items.productId': productId,
  });

  let supplierLeadTimeDays = 0;
  if (preferredSupplierId) {
    const supplier = await Supplier.findById(preferredSupplierId).select('leadTimeDays');
    supplierLeadTimeDays = supplier?.leadTimeDays || 0;
  }

  let stockoutRisk = 'normal';
  if (hasInFlightPurchaseOrder) {
    stockoutRisk = 'covered';
  } else if (stockoutRiskDays != null && supplierLeadTimeDays > 0 && stockoutRiskDays < supplierLeadTimeDays) {
    stockoutRisk = 'critical'; // will likely run out before a fresh PO could arrive, and none is already in flight
  }

  return {
    averageDailyUsage: Math.round(averageDailyUsage * 100) / 100,
    stockoutRiskDays: stockoutRiskDays != null ? Math.round(stockoutRiskDays * 10) / 10 : null,
    hasInFlightPurchaseOrder: !!hasInFlightPurchaseOrder,
    supplierLeadTimeDays,
    stockoutRisk,
  };
}

async function sumOnHand(warehouseId, productId) {
  const rows = await StockLevel.find({ warehouseId, productId });
  return rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
}

module.exports = { upsertRule, listRules, deleteRule, resolveReorderPoint, listBelowReorderPoint, computeStockoutRisk };
