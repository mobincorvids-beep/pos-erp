/**
 * NetworkStockService — "control tower" read view: on-hand quantity per
 * warehouse across the whole company for a product (or every product),
 * grouped by DC vs branch using the warehouseType/parentWarehouseId
 * hierarchy already on Warehouse. Pure aggregation — no new schema.
 */
const StockLevel = require('../models/StockLevel');
const Warehouse = require('../models/Warehouse');
const Product = require('../models/Product');

/**
 * @param {String} companyId
 * @param {Object} [opts]
 * @param {String} [opts.productId] - when omitted, aggregates across every product
 */
async function getNetworkStockView(companyId, { productId } = {}) {
  const warehouses = await Warehouse.find({ companyId }).lean();
  const warehouseById = new Map(warehouses.map((w) => [String(w._id), w]));

  const filter = { companyId, quantity: { $gt: 0 } };
  if (productId) filter.productId = productId;

  const levels = await StockLevel.find(filter).lean();

  // Per warehouse totals (summed across variants/batches).
  const perWarehouse = new Map();
  for (const w of warehouses) {
    perWarehouse.set(String(w._id), {
      warehouseId: w._id,
      warehouseName: w.name,
      warehouseType: w.warehouseType,
      parentWarehouseId: w.parentWarehouseId,
      quantity: 0,
      value: 0,
    });
  }

  for (const level of levels) {
    const row = perWarehouse.get(String(level.warehouseId));
    if (!row) continue; // stock at a warehouse outside this company/query — shouldn't happen given the filter, skip defensively
    row.quantity += level.quantity;
    row.value += level.quantity * (level.avgCost || 0);
  }

  const warehouseRows = [...perWarehouse.values()].map((r) => ({ ...r, value: Math.round(r.value * 100) / 100 }));

  // Group by DC vs branch vs standalone, and roll up each DC's own
  // downstream branches (via parentWarehouseId) so a control-tower view can
  // show "this DC + everything it feeds" at a glance.
  const byType = { distribution_center: [], branch: [], standalone: [] };
  for (const row of warehouseRows) byType[row.warehouseType || 'standalone'].push(row);

  const dcNetworks = byType.distribution_center.map((dc) => {
    const children = warehouseRows.filter((r) => String(r.parentWarehouseId) === String(dc.warehouseId));
    const networkQuantity = dc.quantity + children.reduce((sum, c) => sum + c.quantity, 0);
    const networkValue = Math.round((dc.value + children.reduce((sum, c) => sum + c.value, 0)) * 100) / 100;
    return { ...dc, childWarehouses: children, networkQuantity, networkValue };
  });

  let productInfo = null;
  if (productId) {
    const product = await Product.findById(productId).select('name').lean();
    productInfo = product ? { productId, productName: product.name } : { productId, productName: null };
  }

  return {
    product: productInfo,
    companyTotalQuantity: warehouseRows.reduce((sum, r) => sum + r.quantity, 0),
    companyTotalValue: Math.round(warehouseRows.reduce((sum, r) => sum + r.value, 0) * 100) / 100,
    distributionCenters: dcNetworks,
    branches: byType.branch,
    standaloneWarehouses: byType.standalone,
    warehouses: warehouseRows,
  };
}

module.exports = { getNetworkStockView };
