/**
 * InventoryValuationService — historical (as-of-a-past-date) stock
 * valuation, reconstructed purely from the StockMovement ledger.
 *
 * LIMITATION (documented, not hidden): true point-in-time FIFO/LIFO
 * valuation would require replaying, layer by layer, every movement's own
 * unitCost in strict chronological order per batch, tracking exactly which
 * cost layer each outgoing unit was drawn from. This function does NOT do
 * that. Instead it uses the WEIGHTED-AVERAGE method, consistently, the
 * same costing convention inventoryService.recordMovement() already uses
 * for the *current* StockLevel.avgCost: for each batch (or productId if
 * unbatched) at a warehouse, replay every movement up to and including
 * asOfDate and recompute a running weighted-average cost exactly the way
 * recordMovement() does — incoming costed movements (purchase,
 * production_output, adjustment-with-unitCost) update the average,
 * outgoing movements consume at the current average without changing it.
 * The resulting qty * avgCost as of that date is a reasonable
 * reconstruction, not a precise historical FIFO/LIFO figure — good enough
 * for a "what was stock roughly worth on this date" report, not for an
 * audit that specifically requires FIFO/LIFO.
 */
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');

const COSTED_INCOMING_TYPES = ['purchase', 'production_output', 'adjustment'];

/**
 * @param {String} companyId
 * @param {Object} opts
 * @param {Date|String} opts.asOfDate
 * @param {String} [opts.warehouseId]
 */
async function getHistoricalValuationReport(companyId, { asOfDate, warehouseId } = {}) {
  if (!asOfDate) throw new Error('asOfDate is required.');
  const cutoff = new Date(asOfDate);

  const filter = { companyId, createdAt: { $lte: cutoff } };
  if (warehouseId) filter.warehouseId = warehouseId;

  // Chronological replay — order matters for the running weighted average.
  const movements = await StockMovement.find(filter).sort({ createdAt: 1 }).lean();

  // Grouped per (warehouseId, productId, variantId, batchId) line, mirroring
  // StockLevel's own uniqueness key.
  const lines = new Map();
  for (const m of movements) {
    const key = `${m.warehouseId}:${m.variantId}:${m.batchId || 'null'}`;
    let line = lines.get(key);
    if (!line) {
      line = {
        warehouseId: m.warehouseId, productId: m.productId, variantId: m.variantId, batchId: m.batchId || null,
        quantity: 0, avgCost: 0,
      };
      lines.set(key, line);
    }

    const isCostedIncoming = m.quantity > 0 && COSTED_INCOMING_TYPES.includes(m.type) && m.unitCost != null;
    if (isCostedIncoming) {
      const newQty = line.quantity + m.quantity;
      line.avgCost = newQty > 0 ? ((line.quantity * line.avgCost) + (m.quantity * m.unitCost)) / newQty : 0;
      line.quantity = newQty;
    } else {
      line.quantity += m.quantity;
    }
  }

  const rows = [...lines.values()].filter((l) => l.quantity > 0);

  const productIds = [...new Set(rows.map((r) => String(r.productId)))];
  const products = await Product.find({ _id: { $in: productIds } }).select('name variants').lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  let totalValue = 0;
  const result = rows.map((r) => {
    const product = productById.get(String(r.productId));
    const variant = product?.variants?.find((v) => String(v._id) === String(r.variantId));
    const value = Math.round(r.quantity * r.avgCost * 100) / 100;
    totalValue += value;
    return {
      warehouseId: r.warehouseId,
      productId: r.productId,
      productName: product?.name || null,
      variantId: r.variantId,
      sku: variant?.sku || null,
      batchId: r.batchId,
      quantity: r.quantity,
      avgCost: Math.round(r.avgCost * 100) / 100,
      value,
    };
  });

  return {
    asOfDate: cutoff,
    warehouseId: warehouseId || null,
    method: 'weighted_average', // see module header comment for why not true FIFO/LIFO
    lineCount: result.length,
    totalValue: Math.round(totalValue * 100) / 100,
    lines: result.sort((a, b) => b.value - a.value),
  };
}

module.exports = { getHistoricalValuationReport };
