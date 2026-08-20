/**
 * SerialInventoryService — the one place that validates and moves
 * ProductSerial status at sale/return/void time, so PosSaleService,
 * SaleReturnService, and anything else that touches a serial-tracked line
 * all go through the same rules rather than three slightly different
 * copies. Mirrors how InventoryService is the single point of truth for
 * quantity — this is the equivalent for individual serial identity.
 */
const ProductSerial = require('../models/ProductSerial');

/**
 * Validates that every serial in `serialNumbers` exists for this variant,
 * is physically at this warehouse, and is currently sellable (`in_stock`).
 * Throws a specific, actionable error rather than a generic "not enough
 * stock" — a serial mismatch is a data-entry problem, not a quantity one.
 */
async function assertAvailable(variantId, warehouseId, serialNumbers, session) {
  if (!serialNumbers || serialNumbers.length === 0) return;

  const found = await ProductSerial.find(
    { variantId, serialNumber: { $in: serialNumbers } }
  ).session(session || null);

  const foundBySerial = new Map(found.map((s) => [s.serialNumber, s]));
  const problems = [];

  for (const serial of serialNumbers) {
    const record = foundBySerial.get(serial);
    if (!record) problems.push(`${serial} (not on record for this product)`);
    else if (String(record.warehouseId) !== String(warehouseId)) problems.push(`${serial} (at a different warehouse)`);
    else if (record.status !== 'in_stock') problems.push(`${serial} (status: ${record.status})`);
  }

  if (problems.length > 0) {
    throw new Error(`Serial number(s) not available to sell: ${problems.join(', ')}.`);
  }
}

/** Marks a batch of serials sold and links them to the sale. Call only after assertAvailable() has passed in the same transaction. */
async function markSold(variantId, serialNumbers, saleId, session) {
  if (!serialNumbers || serialNumbers.length === 0) return;
  await ProductSerial.updateMany(
    { variantId, serialNumber: { $in: serialNumbers } },
    { status: 'sold', saleId },
    { session }
  );
}

/** Reverses a sale's hold on these serials — used by both void (all serials on the line) and a partial return (just the returned subset). Goods are assumed resellable; use a separate QC-style flow if that's ever not true. */
async function releaseToStock(variantId, serialNumbers, session) {
  if (!serialNumbers || serialNumbers.length === 0) return;
  await ProductSerial.updateMany(
    { variantId, serialNumber: { $in: serialNumbers } },
    { status: 'in_stock', saleId: null },
    { session }
  );
}

module.exports = { assertAvailable, markSold, releaseToStock };
