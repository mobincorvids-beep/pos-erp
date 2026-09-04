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

/** Real on-hand quantity for a product at a warehouse, summed across all its variants (from StockLevel, the existing source of truth). */
async function productOnHandAtWarehouse(warehouseId, productId) {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found.');
  const variantIds = (product.variants || []).map((v) => v._id);
  if (variantIds.length === 0) return 0;
  const levels = await StockLevel.find({ warehouseId, variantId: { $in: variantIds } });
  return levels.reduce((sum, l) => sum + (l.quantity || 0), 0);
}

/** Total quantity of a product already located to bins at a warehouse (excluding, optionally, one bin, used when moving/reassigning). */
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
    throw new Error(`Cannot assign ${quantity} units to this bin, only ${Math.max(onHand - otherBinsTotal - currentBinQty, 0)} unassigned units are available for this product at this warehouse.`);
  }

  const updated = await BinStock.findOneAndUpdate(
    { binId, productId },
    { $inc: { quantity }, $setOnInsert: { companyId: bin.companyId, warehouseId: bin.warehouseId } },
    { upsert: true, new: true }
  );
  return updated;
}

/** Moves already-located stock from one bin to another (does not touch StockLevel, purely a location change). */
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

/**
 * Session-aware, non-throwing bin-quantity delta used by inventoryService.
 * recordMovement() so BinStock stops being a shadow ledger that only moves
 * when someone remembers to call assignStockToBin/moveBinStock: every real
 * stock movement now nudges BinStock too, positive or negative, for
 * whichever bin it names. It never rejects on insufficient bin quantity —
 * clamping at zero and returning how much was actually applied — because
 * this runs as a best-effort side-channel to the movement that already
 * happened in StockLevel (which stays the true on-hand source of truth);
 * refusing the whole stock movement over a stale bin row would be worse
 * than a bin count that's briefly a little behind.
 */
async function adjustBinStock({ binId, productId, quantity, companyId, warehouseId }, session) {
  if (!binId || !quantity) return null;
  const bin = await WarehouseBin.findById(binId).session(session || null);
  if (!bin) return null;

  if (quantity > 0) {
    return BinStock.findOneAndUpdate(
      { binId, productId },
      { $inc: { quantity }, $setOnInsert: { companyId: companyId || bin.companyId, warehouseId: warehouseId || bin.warehouseId } },
      { upsert: true, new: true, session }
    );
  }

  const existing = await BinStock.findOne({ binId, productId }).session(session || null);
  const currentQty = existing?.quantity || 0;
  const applied = Math.min(currentQty, -quantity); // clamp — never drive a bin negative
  if (applied <= 0) return existing || null;
  return BinStock.findOneAndUpdate(
    { binId, productId },
    { $inc: { quantity: -applied } },
    { new: true, session }
  );
}

/**
 * Greedily plans which existing bin rows to draw a quantity down from when
 * the caller (a sale, an adjustment, a manufacturing consumption — anything
 * that goes through recordMovement without already knowing a specific bin)
 * doesn't know or care which bin the units physically leave from. Oldest-
 * touched bin first is an arbitrary but reasonable default in the absence
 * of a real FEFO-at-bin-level policy. Returns whatever plan is coverable —
 * a product with less bin-located stock than the movement quantity (e.g.
 * some of it was never putaway'd to a bin) simply leaves the shortfall
 * untracked at bin level, same as today.
 */
async function planBinConsumption(warehouseId, productId, quantityNeeded, session) {
  const rows = await BinStock.find({ warehouseId, productId, quantity: { $gt: 0 } })
    .sort({ updatedAt: 1 })
    .session(session || null);
  let remaining = quantityNeeded;
  const plan = [];
  for (const row of rows) {
    if (remaining <= 0) break;
    const take = Math.min(row.quantity, remaining);
    if (take > 0) {
      plan.push({ binId: row.binId, quantity: take });
      remaining -= take;
    }
  }
  return plan;
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
  adjustBinStock,
  planBinConsumption,
};
