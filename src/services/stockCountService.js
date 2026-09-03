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
const BinStock = require('../models/BinStock');
const WarehouseBin = require('../models/WarehouseBin');
const inventoryService = require('./inventoryService');
const auditService = require('./auditService');
const reportingService = require('./reportingService');
const { nextDocumentNumber } = require('./numberingService');

/** Resolves scope.zoneId to the set of productIds currently located (via BinStock) to bins in that zone. Reuses the existing bin-location breakdown rather than adding a new one. */
async function productIdsForZone(companyId, warehouseId, zoneId) {
  const bins = await WarehouseBin.find({ companyId, warehouseId, zoneId });
  if (bins.length === 0) return [];
  const binIds = bins.map((b) => b._id);
  const rows = await BinStock.find({ warehouseId, binId: { $in: binIds }, quantity: { $gt: 0 } }).distinct('productId');
  return rows.map(String);
}

/** Resolves scope.abcClass to the set of productIds in that class, reusing reportingService.abcAnalysisReport (last-90-days sales) rather than re-deriving ABC classification here. */
async function productIdsForAbcClass(companyId, abcClass) {
  const to = new Date();
  const from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000);
  const { rows } = await reportingService.abcAnalysisReport(companyId, from, to);
  return [...new Set(rows.filter((r) => r.class === abcClass).map((r) => String(r.productId)))];
}

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} input.warehouseId
 * @param {Array} [input.variantIds] - explicit variant subset (existing behaviour, scope defaults to 'full')
 * @param {Object} [input.scope] - { type: 'full'|'zone'|'abc_class', zoneId, abcClass } — an alternative,
 *   named way to scope a partial/rolling cycle count instead of (or in addition to) passing variantIds
 *   directly. 'zone' and 'abc_class' resolve to a productId subset and are ANDed with any variantIds given.
 * @param {String} input.userId
 */
async function startCount({ companyId, warehouseId, variantIds, scope, userId }) {
  const filter = { companyId, warehouseId };
  if (variantIds && variantIds.length > 0) filter.variantId = { $in: variantIds };

  const resolvedScope = scope && scope.type && scope.type !== 'full' ? scope : { type: 'full' };

  if (resolvedScope.type === 'zone') {
    if (!resolvedScope.zoneId) throw new Error('scope.zoneId is required for a zone-scoped count.');
    const productIds = await productIdsForZone(companyId, warehouseId, resolvedScope.zoneId);
    if (productIds.length === 0) throw new Error('No stock is currently located to bins in that zone.');
    filter.productId = { $in: productIds };
  } else if (resolvedScope.type === 'abc_class') {
    if (!resolvedScope.abcClass) throw new Error('scope.abcClass is required for an ABC-class-scoped count.');
    const productIds = await productIdsForAbcClass(companyId, resolvedScope.abcClass);
    if (productIds.length === 0) throw new Error(`No products fall in ABC class "${resolvedScope.abcClass}" for the recent sales window.`);
    filter.productId = { $in: productIds };
  }

  const levels = await StockLevel.find(filter);
  if (levels.length === 0) throw new Error('No stock found for this warehouse (or filter) to count.');

  return StockCount.create({
    companyId, warehouseId, userId,
    countNumber: nextDocumentNumber('CNT'),
    items: levels.map((l) => ({
      productId: l.productId, variantId: l.variantId, batchId: l.batchId,
      systemQuantity: l.quantity, countedQuantity: null,
    })),
    scope: resolvedScope,
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
