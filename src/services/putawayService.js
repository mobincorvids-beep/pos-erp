/**
 * PutawayService — suggests where to bin a product being received, without
 * forcing the suggestion on anyone. Pure read/recommendation layer on top
 * of the existing bin-location system (WarehouseBin / BinStock /
 * WarehouseZone) — it never writes anything itself; the actual location
 * assignment still happens through warehouseZoneService.assignStockToBin
 * (or the free-text GoodsReceivedNote.items[].binLocation note) exactly as
 * before.
 *
 * Strategy, in priority order:
 *   1. Consolidate — an existing bin in this warehouse already holding
 *      this product (put more of the same thing where it already is).
 *   2. Category zone — an empty bin (no BinStock rows) inside a zone whose
 *      `code` matches the product's category, if any zone is tagged that
 *      way (WarehouseZone.code is free-text; this treats it as an
 *      optional category tag rather than adding a new field to the zone
 *      model).
 *   3. Any bin with capacity left — any active bin whose current total
 *      BinStock quantity is below its `capacity` (or has no capacity cap
 *      at all).
 * Returns null (not an error) when the warehouse has no bins at all, or
 * every bin is genuinely full — receiving must still be able to proceed
 * without a suggestion.
 */
const WarehouseBin = require('../models/WarehouseBin');
const WarehouseZone = require('../models/WarehouseZone');
const BinStock = require('../models/BinStock');
const Product = require('../models/Product');

/** Total units currently located in a bin, across all products (used against its capacity cap). */
async function binOccupiedTotal(binId) {
  const rows = await BinStock.find({ binId });
  return rows.reduce((sum, r) => sum + (r.quantity || 0), 0);
}

/**
 * @param {String} companyId
 * @param {String} warehouseId
 * @param {String} productId
 * @param {Number} [quantity] - how much is being put away; used only to
 *   check it fits within a candidate bin's remaining capacity, not to
 *   reserve anything.
 * @returns {Promise<{binId: String, binCode: String, reason: String} | null>}
 */
async function suggestPutawayBin(companyId, warehouseId, productId, quantity = 0) {
  // 1. Consolidate: a bin in this warehouse that already holds this product.
  const existing = await BinStock.findOne({ companyId, warehouseId, productId, quantity: { $gt: 0 } })
    .sort({ quantity: -1 })
    .populate('binId');
  if (existing?.binId && existing.binId.isActive !== false) {
    return { binId: String(existing.binId._id), binCode: existing.binId.binCode, reason: 'consolidate_existing' };
  }

  const bins = await WarehouseBin.find({ companyId, warehouseId, isActive: true });
  if (bins.length === 0) return null;

  // 2. Category zone: an empty bin inside a zone tagged (by code) for this
  // product's category, if the tenant uses that convention.
  const product = await Product.findById(productId);
  if (product?.categoryId) {
    const zones = await WarehouseZone.find({ companyId, warehouseId, code: String(product.categoryId) });
    if (zones.length > 0) {
      const zoneIds = zones.map((z) => String(z._id));
      const candidateBins = bins.filter((b) => b.zoneId && zoneIds.includes(String(b.zoneId)));
      for (const bin of candidateBins) {
        const occupied = await binOccupiedTotal(bin._id);
        if (occupied === 0) {
          return { binId: String(bin._id), binCode: bin.binCode, reason: 'category_zone_empty_bin' };
        }
      }
    }
  }

  // 3. Any bin with room left (or no capacity cap at all).
  for (const bin of bins) {
    if (bin.capacity == null) {
      return { binId: String(bin._id), binCode: bin.binCode, reason: 'has_capacity' };
    }
    const occupied = await binOccupiedTotal(bin._id);
    if (occupied + (quantity || 0) <= bin.capacity) {
      return { binId: String(bin._id), binCode: bin.binCode, reason: 'has_capacity' };
    }
  }

  return null;
}

module.exports = { suggestPutawayBin };
