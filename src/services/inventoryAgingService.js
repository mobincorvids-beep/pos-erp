/**
 * InventoryAgingService — buckets on-hand batch quantities by age (days
 * since the batch's receivedDate, falling back to createdAt for batches
 * created before that field existed — see ProductBatch.receivedDate), and
 * a write-off workflow that posts the disposal as a real stock movement.
 */
const StockLevel = require('../models/StockLevel');
const ProductBatch = require('../models/ProductBatch');
const Product = require('../models/Product');
const inventoryService = require('./inventoryService');
const auditService = require('./auditService');

const BUCKETS = [
  { label: '0-30', min: 0, max: 30 },
  { label: '31-60', min: 31, max: 60 },
  { label: '61-90', min: 61, max: 90 },
  { label: '90+', min: 91, max: Infinity },
];

function bucketFor(ageDays) {
  return BUCKETS.find((b) => ageDays >= b.min && ageDays <= b.max)?.label || '90+';
}

/**
 * @param {String} companyId
 * @param {Object} [opts]
 * @param {String} [opts.warehouseId]
 */
async function getInventoryAgingReport(companyId, { warehouseId } = {}) {
  const filter = { companyId, quantity: { $gt: 0 }, batchId: { $ne: null } };
  if (warehouseId) filter.warehouseId = warehouseId;

  const levels = await StockLevel.find(filter).lean();
  if (levels.length === 0) {
    return { warehouseId: warehouseId || null, buckets: BUCKETS.map((b) => ({ bucket: b.label, quantity: 0, value: 0 })), lines: [] };
  }

  const batchIds = [...new Set(levels.map((l) => String(l.batchId)))];
  const batches = await ProductBatch.find({ _id: { $in: batchIds } }).lean();
  const batchById = new Map(batches.map((b) => [String(b._id), b]));

  const productIds = [...new Set(levels.map((l) => String(l.productId)))];
  const products = await Product.find({ _id: { $in: productIds } }).select('name variants').lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const now = Date.now();
  const bucketTotals = new Map(BUCKETS.map((b) => [b.label, { quantity: 0, value: 0 }]));
  const lines = [];

  for (const level of levels) {
    const batch = batchById.get(String(level.batchId));
    const receivedDate = batch?.receivedDate || batch?.createdAt;
    if (!receivedDate) continue; // no way to age this line — skip rather than misreport

    const ageDays = Math.floor((now - new Date(receivedDate).getTime()) / (24 * 60 * 60 * 1000));
    const bucket = bucketFor(ageDays);
    const value = Math.round(level.quantity * (level.avgCost || 0) * 100) / 100;

    const totals = bucketTotals.get(bucket);
    totals.quantity += level.quantity;
    totals.value += value;

    const product = productById.get(String(level.productId));
    const variant = product?.variants?.find((v) => String(v._id) === String(level.variantId));
    lines.push({
      warehouseId: level.warehouseId,
      productId: level.productId,
      productName: product?.name || null,
      variantId: level.variantId,
      sku: variant?.sku || null,
      batchId: level.batchId,
      batchNumber: batch?.batchNumber || null,
      quantity: level.quantity,
      avgCost: level.avgCost || 0,
      value,
      receivedDate,
      ageDays,
      bucket,
    });
  }

  return {
    warehouseId: warehouseId || null,
    buckets: BUCKETS.map((b) => ({
      bucket: b.label,
      quantity: bucketTotals.get(b.label).quantity,
      value: Math.round(bucketTotals.get(b.label).value * 100) / 100,
    })),
    lines: lines.sort((a, b) => b.ageDays - a.ageDays),
  };
}

/**
 * Posts a write-off: a stock-out 'adjustment' movement (reuses
 * inventoryService.recordMovement, the single point of truth for every
 * stock change) with a reason-coded note.
 *
 * TODO(accounting): there is no existing hook that posts an 'adjustment'
 * stock-out to Financial Management as a journal voucher (unlike
 * purchase/sale, which do post through accountingService) — a real
 * write-off should reduce a Stock Asset account and hit a Write-off/Loss
 * expense account for `quantity * avgCost`. Wiring that up is out of
 * scope here (it needs a defaultAccountsService write-off/loss account
 * that doesn't currently exist); this just leaves the movement + note as
 * the audit trail until that JV-posting hook is built.
 */
async function writeOffInventory(companyId, { productId, variantId, batchId, quantity, reason, userId }) {
  if (!quantity || quantity <= 0) throw new Error('quantity must be a positive number.');
  if (!reason) throw new Error('reason is required for a write-off.');

  const level = await StockLevel.findOne({ productId, variantId, batchId: batchId || null, companyId });
  if (!level) throw new Error('No stock level found for this product/variant/batch.');

  const movement = await inventoryService.recordMovement({
    companyId,
    warehouseId: level.warehouseId,
    productId,
    variantId,
    batchId: batchId || null,
    type: 'adjustment',
    quantity: -Math.abs(quantity),
    referenceType: 'InventoryWriteOff',
    referenceId: null,
    userId,
    note: `Write-off: ${reason}`,
  });

  await auditService.record({
    companyId, userId, action: 'inventory.write_off', entityType: 'StockMovement', entityId: movement._id,
    metadata: { productId, variantId, batchId, quantity, reason },
  });

  return movement;
}

module.exports = { getInventoryAgingReport, writeOffInventory, BUCKETS };
