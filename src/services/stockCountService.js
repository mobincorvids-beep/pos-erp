/**
 * StockCountService — physical stocktake with variance reconciliation.
 * startCount() snapshots what the system currently thinks is on hand for a
 * warehouse (optionally a subset of variants — a full warehouse recount is
 * rarely practical). submitCount() compares counted vs system quantity and
 * posts one 'adjustment' movement per line with a variance, through
 * InventoryService like every other stock change.
 */
const mongoose = require('mongoose');
const StockCount = require('../models/StockCount');
const StockLevel = require('../models/StockLevel');
const inventoryService = require('./inventoryService');
const auditService = require('./auditService');
const { nextDocumentNumber } = require('./numberingService');

async function startCount({ companyId, warehouseId, variantIds, userId }) {
  const filter = { companyId, warehouseId };
  if (variantIds && variantIds.length > 0) filter.variantId = { $in: variantIds };

  const levels = await StockLevel.find(filter);
  if (levels.length === 0) throw new Error('No stock found for this warehouse (or variant filter) to count.');

  return StockCount.create({
    companyId, warehouseId, userId,
    countNumber: nextDocumentNumber('CNT'),
    items: levels.map((l) => ({
      productId: l.productId, variantId: l.variantId, batchId: l.batchId,
      systemQuantity: l.quantity, countedQuantity: null,
    })),
  });
}

/** Records counted quantities for one or more lines, can be called multiple times as staff progress through the count. */
async function recordCounts(stockCountId, counts) {
  const stockCount = await StockCount.findById(stockCountId);
  if (!stockCount) throw new Error('Stock count not found.');
  if (stockCount.status !== 'in_progress') throw new Error('This stock count has already been submitted.');

  for (const { itemId, countedQuantity } of counts) {
    const item = stockCount.items.id(itemId);
    if (!item) throw new Error(`Stock count item ${itemId} not found.`);
    item.countedQuantity = countedQuantity;
  }
  await stockCount.save();
  return stockCount;
}

/** Finalizes the count: any line with a variance (counted != system) gets a real adjustment movement. */
async function submitCount(stockCountId, userId) {
  const session = await mongoose.startSession();
  try {
    let stockCount;
    await session.withTransaction(async () => {
      stockCount = await StockCount.findById(stockCountId).session(session);
      if (!stockCount) throw new Error('Stock count not found.');
      if (stockCount.status !== 'in_progress') throw new Error('This stock count has already been submitted.');

      const uncounted = stockCount.items.filter((i) => i.countedQuantity === null);
      if (uncounted.length > 0) {
        throw new Error(`${uncounted.length} item(s) have not been counted yet. Record all counts before submitting.`);
      }

      for (const item of stockCount.items) {
        const variance = item.countedQuantity - item.systemQuantity;
        if (variance === 0) continue;

        await inventoryService.recordMovement({
          companyId: stockCount.companyId, warehouseId: stockCount.warehouseId,
          productId: item.productId, variantId: item.variantId, batchId: item.batchId,
          type: 'adjustment', quantity: variance,
          referenceType: 'StockCount', referenceId: stockCount._id, userId,
          note: `Stocktake ${stockCount.countNumber}: system ${item.systemQuantity}, counted ${item.countedQuantity}`,
        }, session);
      }

      stockCount.status = 'submitted';
      stockCount.submittedAt = new Date();
      await stockCount.save({ session });

      await auditService.record({
        companyId: stockCount.companyId, userId, action: 'stock_count.submitted',
        entityType: 'StockCount', entityId: stockCount._id,
        metadata: { countNumber: stockCount.countNumber, itemCount: stockCount.items.length },
      }, session);
    });
    return stockCount;
  } finally {
    session.endSession();
  }
}

/**
 * Deletes a stocktake outright, but only while it's still in_progress — no
 * adjustment movements have been posted yet at that point, so nothing in
 * the stock ledger references it. A submitted count has already posted
 * ledger-traceable adjustments (see submitCount above); deleting it would
 * silently orphan those movements' referenceId, so that's blocked here
 * rather than attempted as a reversal.
 */
async function deleteCount(stockCountId, companyId, userId) {
  const stockCount = await StockCount.findOne({ _id: stockCountId, companyId });
  if (!stockCount) throw new Error('Stock count not found.');
  if (stockCount.status !== 'in_progress') {
    throw new Error('This stock count has already been submitted and posted stock adjustments, so it cannot be deleted.');
  }

  await StockCount.deleteOne({ _id: stockCount._id });

  await auditService.record({
    companyId, userId, action: 'stock_count.deleted',
    entityType: 'StockCount', entityId: stockCount._id,
    metadata: { countNumber: stockCount.countNumber, itemCount: stockCount.items.length },
  });
}

/** Removes a single not-yet-counted line from an in_progress count (e.g. a variant that shouldn't be part of this stocktake). */
async function removeItem(stockCountId, itemId, companyId) {
  const stockCount = await StockCount.findOne({ _id: stockCountId, companyId });
  if (!stockCount) throw new Error('Stock count not found.');
  if (stockCount.status !== 'in_progress') throw new Error('This stock count has already been submitted.');

  const item = stockCount.items.id(itemId);
  if (!item) throw new Error(`Stock count item ${itemId} not found.`);
  item.deleteOne();

  await stockCount.save();
  return stockCount;
}

module.exports = { startCount, recordCounts, submitCount, deleteCount, removeItem };
