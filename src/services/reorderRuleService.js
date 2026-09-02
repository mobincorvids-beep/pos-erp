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
  const rules = await ReorderRule.find({ companyId, warehouseId, isActive: true }).populate('productId', 'name sku reorderLevel');
  const ruledProductIds = new Set(rules.map((r) => String(r.productId._id)));

  const results = [];

  for (const rule of rules) {
    if (!rule.productId) continue;
    const onHand = await sumOnHand(warehouseId, rule.productId._id);
    if (onHand <= rule.minQty) {
      results.push({
        productId: rule.productId._id, productName: rule.productId.name, sku: rule.productId.sku,
        onHand, minQty: rule.minQty, maxQty: rule.maxQty ?? rule.minQty * 2, source: 'warehouse_rule',
      });
    }
  }

  // Products with no warehouse-specific rule still fall back to their
  // product-level default, same as inventoryService/mrpService.
  const defaultProducts = await Product.find({
    companyId, isActive: true, reorderLevel: { $gt: 0 }, _id: { $nin: [...ruledProductIds] },
  }).select('name sku reorderLevel');

  for (const product of defaultProducts) {
    const onHand = await sumOnHand(warehouseId, product._id);
    if (onHand <= product.reorderLevel) {
      results.push({
        productId: product._id, productName: product.name, sku: product.sku,
        onHand, minQty: product.reorderLevel, maxQty: product.reorderLevel * 2, source: 'product_default',
      });
    }
  }

  return results.sort((a, b) => a.onHand - a.minQty - (b.onHand - b.minQty));
}

async function sumOnHand(warehouseId, productId) {
  const rows = await StockLevel.find({ warehouseId, productId });
  return rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
}

module.exports = { upsertRule, listRules, deleteRule, resolveReorderPoint, listBelowReorderPoint };
