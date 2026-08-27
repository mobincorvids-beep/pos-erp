/**
 * WarehouseZoneService — bin-level location tracking layered on top of
 * the existing warehouse-level stock system (StockLevel / inventoryService).
 *
 * IMPORTANT: this service never writes to StockLevel and never changes how
 * a product's on-hand quantity is computed. BinStock is purely a finer-
 * grained "where within the warehouse" breakdown of stock that
 * inventoryService already tracks. assignStockToBin() validates against
 * the real on-hand quantity (summed from StockLevel across the product's
 * variants at that warehouse) so the bin breakdown can never claim more
 * stock exists than actually does.
 */
const WarehouseZone = require('../models/WarehouseZone');
const WarehouseBin = require('../models/WarehouseBin');
const BinStock = require('../models/BinStock');
const Product = require('../models/Product');
const StockLevel = require('../models/StockLevel');

async function createZone({ companyId, warehouseId, name, code, type }) {
  return WarehouseZone.create({ companyId, warehouseId, name, code, type });
}

async function createBin({ companyId, warehouseId, zoneId, binCode, capacity }) {
  const existing = await WarehouseBin.findOne({ companyId, warehouseId, binCode });
  if (existing) throw new Error(`Bin code "${binCode}" already exists in this warehouse.`);
  return WarehouseBin.create({ companyId, warehouseId, zoneId: zoneId || null, binCode, capacity: capacity ?? null });
}

async function listZones(companyId, warehouseId) {
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  return WarehouseZone.find(filter).sort({ name: 1 });
}

async function listBins(warehouseId, companyId) {
  const filter = { warehouseId };
  if (companyId) filter.companyId = companyId;
  return WarehouseBin.find(filter).sort({ binCode: 1 });
}

/** Real on-hand quantity for a product at a warehouse, summed across all its variants (from StockLevel — the existing source of truth). */
async function productOnHandAtWarehouse(warehouseId, productId) {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found.');
  const variantIds = (product.variants || []).map((v) => v._id);
  if (variantIds.length === 0) return 0;
  const levels = await StockLevel.find({ warehouseId, variantId: { $in: variantIds } });
  return levels.reduce((sum, l) => sum + (l.quantity || 0), 0);
}

/** Total quantity of a product already located to bins at a warehouse (excluding, optionally, one bin — used when moving/reassigning). */
async function binAssignedTotal(warehouseId, productId, excludeBinId = null) {
  const filter = { warehouseId, productId };
  if (excludeBinId) filter.binId = { $ne: excludeBinId };
  const rows = await BinStock.find(filter);
  return rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
}

/**
 * Sets/increments how much of a product sits in a given bin. Validates
 * that the resulting sum of all bin assignments for this product at this
 * warehouse never exceeds the product's actual on-hand quantity there —
 * this is a location breakdown of existing stock, not a new stock entry.
 */
async function assignStockToBin(binId, productId, quantity) {
  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than zero.');

  const bin = await WarehouseBin.findById(binId);
  if (!bin) throw new Error('Bin not found.');

  const onHand = await productOnHandAtWarehouse(bin.warehouseId, productId);
  const existing = await BinStock.findOne({ binId, productId });
  const currentBinQty = existing?.quantity || 0;
  const otherBinsTotal = await binAssignedTotal(bin.warehouseId, productId, binId);

  if (otherBinsTotal + currentBinQty + quantity > onHand) {
    throw new Error(`Cannot assign ${quantity} units to this bin — only ${Math.max(onHand - otherBinsTotal - currentBinQty, 0)} unassigned units are available for this product at this warehouse.`);
  }

  const updated = await BinStock.findOneAndUpdate(
    { binId, productId },
    { $inc: { quantity }, $setOnInsert: { companyId: bin.companyId, warehouseId: bin.warehouseId } },
    { upsert: true, new: true }
  );
  return updated;
}

/** Moves already-located stock from one bin to another (does not touch StockLevel — purely a location change). */
async function moveBinStock(fromBinId, toBinId, productId, quantity) {
  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than zero.');
  if (String(fromBinId) === String(toBinId)) throw new Error('Source and destination bins must differ.');

  const fromBin = await WarehouseBin.findById(fromBinId);
  const toBin = await WarehouseBin.findById(toBinId);
  if (!fromBin || !toBin) throw new Error('Bin not found.');
  if (String(fromBin.warehouseId) !== String(toBin.warehouseId)) {
    throw new Error('Cannot move bin stock between different warehouses.');
  }

  const fromStock = await BinStock.findOne({ binId: fromBinId, productId });
  if (!fromStock || fromStock.quantity < quantity) {
    throw new Error('Not enough stock in the source bin to move.');
  }

  fromStock.quantity -= quantity;
  await fromStock.save();

  await BinStock.findOneAndUpdate(
    { binId: toBinId, productId },
    { $inc: { quantity }, $setOnInsert: { companyId: toBin.companyId, warehouseId: toBin.warehouseId } },
    { upsert: true }
  );

  return { fromBinId, toBinId, productId, quantity };
}

/** Bin-by-bin stock breakdown for a warehouse, with bin/zone details attached. */
async function binStockSummary(warehouseId) {
  const rows = await BinStock.find({ warehouseId, quantity: { $gt: 0 } })
    .populate('binId')
    .populate('productId', 'name sku barcode');
  return rows.map((r) => ({
    _id: r._id,
    binId: r.binId?._id,
    binCode: r.binId?.binCode,
    zoneId: r.binId?.zoneId,
    productId: r.productId?._id,
    productName: r.productId?.name,
    productSku: r.productId?.sku,
    quantity: r.quantity,
  }));
}

module.exports = {
  createZone,
  createBin,
  listZones,
  listBins,
  assignStockToBin,
  moveBinStock,
  binStockSummary,
  productOnHandAtWarehouse,
  binAssignedTotal,
};
