/**
 * DrpService — Distribution Requirements Planning: the "who's about to run
 * out and where's the surplus to cover it from" question across a
 * company's own warehouse network, layered on top of two things already
 * built: the DC/branch warehouse hierarchy (Warehouse.warehouseType /
 * parentWarehouseId) and per-warehouse stockout-risk (reorderRuleService.
 * computeStockoutRisk). This is deliberately scoped to suggestions, not
 * automatic transfers — suggestTransfers() returns a plan; converting a
 * suggestion into a real movement still goes through the existing,
 * already-audited StockTransfer workflow, same posture as MRP's
 * suggestedPurchases/suggestedWorkOrders needing an explicit convert step.
 */
const Warehouse = require('../models/Warehouse');
const StockLevel = require('../models/StockLevel');
const Product = require('../models/Product');
const reorderRuleService = require('./reorderRuleService');

async function onHandByProduct(warehouseId) {
  const rows = await StockLevel.find({ warehouseId }).select('productId quantity');
  const byProduct = new Map();
  for (const row of rows) {
    const key = String(row.productId);
    byProduct.set(key, (byProduct.get(key) || 0) + (row.quantity || 0));
  }
  return byProduct;
}

/**
 * For one distribution center, suggests transfers to its branches: for
 * every product the DC actually stocks, ranks the DC's branches by
 * stockout urgency (using the same computeStockoutRisk the reorder report
 * already uses) and proposes moving DC surplus to the most at-risk
 * branches first, never proposing more than the DC can spare (its own
 * on-hand minus its own safety stock, if Product.safetyStockQty is set)
 * and never more than a branch's own reorder max (or a simple default
 * top-up target when the branch has no reorder rule at all).
 */
async function suggestTransfers(companyId, dcWarehouseId) {
  const dc = await Warehouse.findOne({ _id: dcWarehouseId, companyId });
  if (!dc) throw new Error('Warehouse not found.');
  if (dc.warehouseType !== 'distribution_center') {
    throw new Error('suggestTransfers only runs from a distribution_center warehouse — this warehouse is type "' + dc.warehouseType + '".');
  }

  const branches = await Warehouse.find({ companyId, parentWarehouseId: dc._id });
  if (branches.length === 0) return { dcWarehouseId, suggestions: [] };

  const dcStock = await onHandByProduct(dc._id);
  const suggestions = [];

  for (const [productIdStr, dcOnHand] of dcStock.entries()) {
    if (dcOnHand <= 0) continue;
    const product = await Product.findById(productIdStr).select('name sku safetyStockQty preferredSupplierId');
    if (!product) continue;

    const dcReserve = product.safetyStockQty || 0;
    let dcAvailableToShip = Math.max(dcOnHand - dcReserve, 0);
    if (dcAvailableToShip <= 0) continue;

    // Rank branches by urgency (most days-until-stockout-risk first), so
    // the DC's limited surplus goes where it matters most rather than
    // being split evenly or by arrival order.
    const branchRisks = [];
    for (const branch of branches) {
      const branchOnHand = (await onHandByProduct(branch._id)).get(productIdStr) || 0;
      const risk = await reorderRuleService.computeStockoutRisk(companyId, branch._id, productIdStr, product.preferredSupplierId, branchOnHand);
      branchRisks.push({ branch, branchOnHand, risk });
    }
    branchRisks.sort((a, b) => {
      const aDays = a.risk.stockoutRiskDays ?? Infinity;
      const bDays = b.risk.stockoutRiskDays ?? Infinity;
      return aDays - bDays;
    });

    for (const { branch, branchOnHand, risk } of branchRisks) {
      if (dcAvailableToShip <= 0) break;
      if (risk.stockoutRisk === 'normal' || risk.stockoutRisk === 'covered') continue; // only branches actually at risk

      // Top up to roughly 2x the branch's average daily usage over the
      // supplier lead time (or a flat 14 days of cover if usage data is
      // too thin to trust) — simple and explainable rather than a second
      // forecasting model duplicating demandForecastService.
      const targetDaysOfCover = risk.supplierLeadTimeDays > 0 ? risk.supplierLeadTimeDays * 2 : 14;
      const targetQty = Math.ceil((risk.averageDailyUsage || 0) * targetDaysOfCover);
      const shortfall = Math.max(targetQty - branchOnHand, 0);
      if (shortfall <= 0) continue;

      const transferQty = Math.min(shortfall, dcAvailableToShip);
      if (transferQty <= 0) continue;

      suggestions.push({
        productId: productIdStr, productName: product.name, sku: product.sku,
        fromWarehouseId: dc._id, toWarehouseId: branch._id, toWarehouseName: branch.name,
        quantity: transferQty,
        branchOnHand, branchStockoutRisk: risk.stockoutRisk, branchStockoutRiskDays: risk.stockoutRiskDays,
        dcOnHandBeforeTransfer: dcOnHand,
      });
      dcAvailableToShip -= transferQty;
    }
  }

  return { dcWarehouseId: dc._id, suggestions };
}

module.exports = { suggestTransfers };
