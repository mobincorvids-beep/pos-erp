/**
 * ScanService — resolves what a barcode scanner reads (a product's SKU/
 * barcode, or a bin's binCode label) to the real document a scanner-driven
 * warehouse UI needs (productId/variantId, binId), plus a scan-to-pick
 * confirmation step for PickWaveLine.
 *
 * Pure lookup/reuse layer: resolveProduct/resolveBin do read-only queries
 * against the existing Product and WarehouseBin models (no new source of
 * truth), and confirmPick delegates the actual pick bookkeeping — the
 * quantity/bin-stock decrement, line status, wave status roll-up — to
 * pickWaveService.recordPick() rather than re-implementing any of it.
 */
const Product = require('../models/Product');
const WarehouseBin = require('../models/WarehouseBin');
const PickWaveLine = require('../models/PickWaveLine');
const pickWaveService = require('./pickWaveService');

/**
 * Resolves a scanned barcode/SKU to a product (and, if the scan matched a
 * variant-level barcode/sku, the specific variantId).
 */
async function resolveProduct(companyId, code) {
  const value = String(code || '').trim();
  if (!value) throw new Error('A barcode or SKU is required.');

  let product = await Product.findOne({ companyId, $or: [{ barcode: value }, { sku: value }] });
  let variantId = null;

  if (!product) {
    product = await Product.findOne({
      companyId,
      $or: [{ 'variants.barcode': value }, { 'variants.sku': value }],
    });
    if (product) {
      const variant = (product.variants || []).find((v) => v.barcode === value || v.sku === value);
      variantId = variant?._id || null;
    }
  }

  if (!product) throw new Error(`No product found for barcode/SKU "${value}".`);
  return { productId: String(product._id), variantId: variantId ? String(variantId) : null, productName: product.name };
}

/** Resolves a scanned bin label to its binId. */
async function resolveBin(companyId, binCode, warehouseId) {
  const value = String(binCode || '').trim();
  if (!value) throw new Error('A bin code is required.');

  const filter = { companyId, binCode: value };
  if (warehouseId) filter.warehouseId = warehouseId;

  const bin = await WarehouseBin.findOne(filter);
  if (!bin) throw new Error(`No bin found for code "${value}".`);
  return { binId: String(bin._id), warehouseId: String(bin.warehouseId), zoneId: bin.zoneId ? String(bin.zoneId) : null };
}

/**
 * Scan-to-pick-confirm: a picker scans the product barcode/SKU and the bin
 * label at the pick face; this resolves both, checks they match what the
 * pick wave line actually expects, and only then calls
 * pickWaveService.recordPick() — never records a pick against the wrong
 * bin/product just because a quantity was supplied.
 */
async function confirmPick({ companyId, pickWaveLineId, productCode, binCode, quantityPicked }) {
  const line = await PickWaveLine.findOne({ _id: pickWaveLineId, companyId });
  if (!line) throw new Error('Pick wave line not found.');

  const { productId } = await resolveProduct(companyId, productCode);
  if (String(productId) !== String(line.productId)) {
    throw new Error('Scanned product does not match this pick wave line.');
  }

  const { binId } = await resolveBin(companyId, binCode);
  if (String(binId) !== String(line.binId)) {
    throw new Error('Scanned bin does not match this pick wave line.');
  }

  return pickWaveService.recordPick(pickWaveLineId, quantityPicked);
}

module.exports = { resolveProduct, resolveBin, confirmPick };
