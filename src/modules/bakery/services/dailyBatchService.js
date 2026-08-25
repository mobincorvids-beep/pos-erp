/**
 * DailyBatchService — same-day perishable production and end-of-day
 * waste write-off. The genuinely new mechanic: closeBatch() isn't a
 * report, it's an ACTION — whatever wasn't sold gets removed from stock
 * and simultaneously recognized as a real expense, in one atomic step.
 * Every prior module that touches "what's left" (Pharmacy's near-expiry
 * report, AI/BI's slow-moving inventory) is purely informational; this is
 * the first one that actually DOES something about it automatically.
 */
const mongoose = require('mongoose');
const DailyBatch = require('../models/DailyBatch');
const inventoryService = require('../../../services/inventoryService');
const accountingService = require('../../../services/accountingService');
const defaultAccountsService = require('../../../services/defaultAccountsService');

/** Records a same-day production run — stock in, exactly like a manufacturing output, just tagged as a batch with a same-day shelf life in mind. */
async function produceBatch(input) {
  const { companyId, branchId, warehouseId, productId, variantId, producedQuantity, unitCost, userId } = input;
  if (!producedQuantity || producedQuantity <= 0) throw new Error('producedQuantity must be greater than zero.');

  const session = await mongoose.startSession();
  try {
    let batch;
    await session.withTransaction(async () => {
      [batch] = await DailyBatch.create(
        [{ companyId, branchId, warehouseId, productId, variantId, producedQuantity, unitCost: unitCost || 0 }],
        { session }
      );

      await inventoryService.recordMovement({
        companyId, warehouseId, productId, variantId,
        type: 'adjustment', quantity: producedQuantity, unitCost: unitCost || 0,
        referenceType: 'DailyBatch', referenceId: batch._id, userId,
        note: 'Same-day bakery/cafe production',
      }, session);
    });
    return batch;
  } finally {
    session.endSession();
  }
}

function listBatches(companyId, { status, warehouseId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (warehouseId) filter.warehouseId = warehouseId;
  return DailyBatch.find(filter).populate('productId', 'name').sort({ producedDate: -1 });
}

/**
 * Closes the day for one batch — checks how much of what was produced is
 * still actually on hand (capped at producedQuantity, since other stock of
 * the same variant might exist from an earlier batch and shouldn't be
 * wasted by this one), writes it off (a negative stock adjustment), and
 * posts a real Dr Waste Expense / Cr Inventory Asset voucher for its cost
 * value — one atomic action, not two separate manual steps a person could
 * forget to do together.
 */
async function closeBatch(batchId, { userId } = {}) {
  const session = await mongoose.startSession();
  try {
    let batch;
    await session.withTransaction(async () => {
      batch = await DailyBatch.findById(batchId).session(session);
      if (!batch) throw new Error('Batch not found.');
      if (batch.status !== 'open') throw new Error(`Cannot close a batch with status "${batch.status}".`);

      const currentStock = await inventoryService.getStockLevel(batch.warehouseId, batch.variantId);
      const wastedQuantity = Math.min(currentStock, batch.producedQuantity);

      if (wastedQuantity > 0) {
        await inventoryService.recordMovement({
          companyId: batch.companyId, warehouseId: batch.warehouseId,
          productId: batch.productId, variantId: batch.variantId,
          type: 'adjustment', quantity: -wastedQuantity, unitCost: batch.unitCost,
          referenceType: 'DailyBatch', referenceId: batch._id, userId,
          note: 'End-of-day waste write-off — unsold same-day perishable stock',
        }, session);

        const wasteValue = Math.round(wastedQuantity * batch.unitCost * 100) / 100;
        const wasteExpenseAccount = await defaultAccountsService.resolve(batch.companyId, 'costOfGoodsSoldId', session); // waste is a real cost of the goods that never sold — reuses the COGS account rather than requiring a separate "Waste" account to be configured
        const inventoryAsset = await defaultAccountsService.resolve(batch.companyId, 'inventoryAssetId', session);

        if (wasteExpenseAccount && inventoryAsset) {
          const voucher = await accountingService.postVoucher({
            companyId: batch.companyId, branchId: batch.branchId, type: 'journal',
            narration: `End-of-day waste write-off for batch produced ${batch.producedDate.toDateString()}`,
            entries: [
              { accountId: wasteExpenseAccount, debit: wasteValue, credit: 0 },
              { accountId: inventoryAsset, debit: 0, credit: wasteValue },
            ],
            referenceType: 'DailyBatch', referenceId: batch._id, userId,
          }, session);
          batch.voucherId = voucher._id;
        }

        batch.wastedQuantity = wastedQuantity;
        batch.wasteValue = wasteValue;
      }

      batch.status = 'closed';
      batch.closedAt = new Date();
      await batch.save({ session });
    });
    return batch;
  } finally {
    session.endSession();
  }
}

/**
 * Corrects a same-day production entry before it's closed out — a
 * mistyped quantity or cost is common at the counter. Only valid while
 * still 'open': closeBatch() has already computed and posted a real
 * waste write-off against whatever was recorded, so editing afterward
 * would desync the batch from both the stock ledger and that voucher.
 * A quantity change adjusts real stock by exactly the delta, the same
 * pattern Retail's layaway quantity edit uses.
 */
async function updateBatch(batchId, { producedQuantity, unitCost, userId }) {
  const session = await mongoose.startSession();
  try {
    let batch;
    await session.withTransaction(async () => {
      batch = await DailyBatch.findById(batchId).session(session);
      if (!batch) throw new Error('Batch not found.');
      if (batch.status !== 'open') throw new Error(`Cannot edit a batch with status "${batch.status}".`);

      if (producedQuantity !== undefined && producedQuantity !== batch.producedQuantity) {
        if (!producedQuantity || producedQuantity <= 0) throw new Error('producedQuantity must be greater than zero.');
        const delta = producedQuantity - batch.producedQuantity;
        await inventoryService.recordMovement({
          companyId: batch.companyId, warehouseId: batch.warehouseId,
          productId: batch.productId, variantId: batch.variantId,
          type: 'adjustment', quantity: delta, unitCost: unitCost ?? batch.unitCost,
          referenceType: 'DailyBatch', referenceId: batch._id, userId,
          note: 'Correction to same-day production entry',
        }, session);
        batch.producedQuantity = producedQuantity;
      }
      if (unitCost !== undefined) {
        if (unitCost < 0) throw new Error('unitCost cannot be negative.');
        batch.unitCost = unitCost;
      }

      await batch.save({ session });
    });
    return batch;
  } finally {
    session.endSession();
  }
}

module.exports = { produceBatch, listBatches, closeBatch, updateBatch };
