/**
 * FefoService — First-Expire-First-Out pick allocation. The genuinely new
 * mechanic: every prior module's "which batch/unit" logic has picked ONE
 * record (a specific serial, a specific reservation). This is the first
 * one that has to allocate across MULTIPLE records to satisfy a single
 * requested quantity — take everything from the earliest-expiring batch,
 * then spill into the next one if that wasn't enough, and so on — a real
 * greedy allocation algorithm, not a single lookup.
 *
 * Deliberately read-only / advisory: this doesn't reserve or deduct
 * anything itself. It tells a picker (or a checkout UI) which batches to
 * take from and how much of each; the actual stock movement still goes
 * through the ordinary inventoryService/posSaleService exactly as always.
 */
const StockLevel = require('../../../models/StockLevel');
const ProductBatch = require('../../../models/ProductBatch');

/**
 * @returns {Promise<{ allocations: Array<{batchId, batchNumber, expiryDate, quantity}>, totalAllocated: number, fullyCovered: boolean, shortfall: number }>}
 */
async function suggestPickOrder(warehouseId, variantId, requiredQuantity) {
  if (!requiredQuantity || requiredQuantity <= 0) throw new Error('requiredQuantity must be greater than zero.');

  const levels = await StockLevel.find({ warehouseId, variantId, quantity: { $gt: 0 } });
  if (levels.length === 0) {
    return { allocations: [], totalAllocated: 0, fullyCovered: false, shortfall: requiredQuantity };
  }

  const batchIds = levels.filter((l) => l.batchId).map((l) => l.batchId);
  const batches = await ProductBatch.find({ _id: { $in: batchIds } });
  const batchById = new Map(batches.map((b) => [String(b._id), b]));

  // Sort earliest-expiring first. A level with no batch (batchId null —
  // non-batch-tracked stock mixed into the same variant) has no expiry
  // urgency at all, so it deliberately sorts LAST, not first — FEFO only
  // means something for stock that actually has an expiry to race against.
  const sorted = [...levels].sort((a, b) => {
    const expiryA = a.batchId ? batchById.get(String(a.batchId))?.expiryDate : null;
    const expiryB = b.batchId ? batchById.get(String(b.batchId))?.expiryDate : null;
    if (!expiryA && !expiryB) return 0;
    if (!expiryA) return 1;  // a has no expiry -> goes after b
    if (!expiryB) return -1; // b has no expiry -> a goes first
    return expiryA - expiryB;
  });

  const allocations = [];
  let remaining = requiredQuantity;

  for (const level of sorted) {
    if (remaining <= 0) break;
    const available = level.quantity - (level.reservedQuantity || 0);
    if (available <= 0) continue;

    const take = Math.min(available, remaining);
    const batch = level.batchId ? batchById.get(String(level.batchId)) : null;
    allocations.push({
      batchId: level.batchId || null,
      batchNumber: batch?.batchNumber || null,
      expiryDate: batch?.expiryDate || null,
      quantity: take,
    });
    remaining -= take;
  }

  const totalAllocated = requiredQuantity - remaining;
  return {
    allocations, totalAllocated,
    fullyCovered: remaining <= 0,
    shortfall: Math.max(0, remaining),
  };
}

module.exports = { suggestPickOrder };
