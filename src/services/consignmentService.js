/**
 * ConsignmentService — the consumption/settlement half of consignment
 * stock. purchaseService.receiveGoods() already does the receiving half:
 * when a PO has isConsignment=true, goods go on-hand as normal but no AP
 * liability is posted, and a ConsignmentStock row is opened per received
 * line instead (see that file).
 *
 * This file covers everything that happens AFTER receipt:
 *  - consumeConsignmentStock: called (best-effort, non-throwing — same
 *    pattern as warehouseZoneService.adjustBinStock) whenever stock that
 *    happens to be consignment-sourced is sold/consumed, to recognize the
 *    liability incrementally (FIFO across ConsignmentStock batches) instead
 *    of all at once at receipt.
 *  - settleConsignmentLiability: pay down the liability created above,
 *    posting Dr Accounts Payable / Cr Cash-or-Bank, mirroring how an
 *    ordinary SupplierPayment clears AP.
 *  - getOutstandingConsignmentLiability: what's currently owed to a
 *    supplier for consumed-but-unsettled consignment stock.
 */
const mongoose = require('mongoose');
const ConsignmentStock = require('../models/ConsignmentStock');
const accountingService = require('./accountingService');
const defaultAccountsService = require('./defaultAccountsService');

/**
 * Consumes up to `quantity` units of a product/variant from the oldest
 * (FIFO, by receivedAt) consignment batches on hand in a warehouse, and
 * posts the corresponding AP liability for what was actually consumed.
 * Non-throwing by design — a consignment-tracking miss must never block
 * the sale/movement that triggered it; the caller (inventoryService) just
 * logs and continues, same as the BinStock sync.
 *
 * @returns {Promise<{consumed: Number, liabilityPosted: Number, batches: Array}>}
 */
async function consumeConsignmentStock(companyId, warehouseId, productId, variantId, quantity, { branchId, referenceType, referenceId, userId, session: outerSession } = {}) {
  if (!quantity || quantity <= 0) return { consumed: 0, liabilityPosted: 0, batches: [] };

  const ownSession = !outerSession;
  const session = outerSession || await mongoose.startSession();
  try {
    if (ownSession) session.startTransaction();

    const batches = await ConsignmentStock.find({
      companyId, warehouseId, productId, variantId, qtyOnHand: { $gt: 0 },
    }).sort({ receivedAt: 1 }).session(session);

    let remaining = quantity;
    let consumed = 0;
    let liabilityPosted = 0;
    const touched = [];

    for (const batch of batches) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, batch.qtyOnHand);
      if (take <= 0) continue;

      batch.qtyOnHand -= take;
      batch.qtyConsumed += take;
      const amount = Math.round(take * batch.unitCost * 100) / 100;
      batch.liabilityAmount += amount;
      await batch.save({ session });

      remaining -= take;
      consumed += take;
      liabilityPosted += amount;
      touched.push({ batchId: batch._id, qty: take, amount });
    }

    if (liabilityPosted > 0) {
      // Dr COGS/Inventory-Expense (the cost was already recognized when the
      // stock moved via the normal recordMovement call at receipt — this
      // voucher's only job is to bring the liability itself onto the
      // books), Cr Accounts Payable — mirrors purchaseService's own
      // receipt-time posting, just deferred to consumption time.
      const cogs = await defaultAccountsService.resolve(companyId, 'costOfGoodsSoldId', session)
        || await defaultAccountsService.resolve(companyId, 'inventoryAssetId', session);
      const payable = await defaultAccountsService.resolve(companyId, 'accountsPayableId', session);
      if (cogs && payable) {
        await accountingService.postVoucher({
          companyId,
          branchId: branchId || null,
          type: 'journal',
          narration: `Consignment stock consumed: ${consumed} unit(s)`,
          entries: [
            { accountId: cogs, debit: liabilityPosted, credit: 0 },
            { accountId: payable, debit: 0, credit: liabilityPosted },
          ],
          referenceType: referenceType || 'ConsignmentStock',
          referenceId: referenceId || (touched[0] && touched[0].batchId) || null,
          userId: userId || null,
        }, session);
      }
      // If either account is missing, the ConsignmentStock rows above are
      // still the source of truth for what's owed — set up "COGS"/
      // "Inventory Asset" and "Accounts Payable" accounts per company to
      // get the ledger posting too.
    }

    if (ownSession) await session.commitTransaction();
    return { consumed, liabilityPosted, batches: touched };
  } catch (err) {
    if (ownSession) {
      try { await session.abortTransaction(); } catch (_) { /* ignore */ }
    }
    console.error('consumeConsignmentStock failed (best-effort, movement itself still succeeded):', err.message);
    return { consumed: 0, liabilityPosted: 0, batches: [], error: err.message };
  } finally {
    if (ownSession) session.endSession();
  }
}

/**
 * Pays down consumed-but-unsettled consignment liability for a supplier,
 * oldest batches first, up to `amount`. Posts Dr Accounts Payable / Cr the
 * given payment account — the same shape as a normal SupplierPayment.
 */
async function settleConsignmentLiability(companyId, supplierId, amount, { branchId, paymentAccountId, userId } = {}) {
  if (!amount || amount <= 0) throw new Error('Settlement amount must be greater than zero.');
  if (!paymentAccountId) throw new Error('paymentAccountId is required to settle consignment liability.');

  const session = await mongoose.startSession();
  try {
    let settled = 0;
    await session.withTransaction(async () => {
      const batches = await ConsignmentStock.find({
        companyId, supplierId,
        $expr: { $gt: ['$liabilityAmount', '$liabilitySettled'] },
      }).sort({ receivedAt: 1 }).session(session);

      let remaining = amount;
      for (const batch of batches) {
        if (remaining <= 0) break;
        const outstanding = batch.liabilityAmount - batch.liabilitySettled;
        if (outstanding <= 0) continue;
        const pay = Math.min(remaining, outstanding);
        batch.liabilitySettled += pay;
        await batch.save({ session });
        remaining -= pay;
        settled += pay;
      }

      if (settled > 0) {
        const payable = await defaultAccountsService.resolve(companyId, 'accountsPayableId', session);
        if (payable) {
          await accountingService.postVoucher({
            companyId,
            branchId: branchId || null,
            type: 'journal',
            narration: `Consignment liability settled — supplier ${supplierId}`,
            entries: [
              { accountId: payable, debit: settled, credit: 0 },
              { accountId: paymentAccountId, debit: 0, credit: settled },
            ],
            referenceType: 'Supplier',
            referenceId: supplierId,
            userId: userId || null,
          }, session);
        }
      }
    });
    return { settled };
  } finally {
    session.endSession();
  }
}

/** Total consumed-but-unsettled consignment liability for a supplier (or all suppliers if omitted). */
async function getOutstandingConsignmentLiability(companyId, supplierId = null) {
  const match = { companyId: new mongoose.Types.ObjectId(companyId) };
  if (supplierId) match.supplierId = new mongoose.Types.ObjectId(supplierId);
  const [result] = await ConsignmentStock.aggregate([
    { $match: match },
    { $group: {
      _id: supplierId ? null : '$supplierId',
      outstanding: { $sum: { $subtract: ['$liabilityAmount', '$liabilitySettled'] } },
      qtyOnHand: { $sum: '$qtyOnHand' },
      qtyConsumed: { $sum: '$qtyConsumed' },
    } },
  ]);
  if (supplierId) {
    return { supplierId, outstanding: result ? result.outstanding : 0, qtyOnHand: result ? result.qtyOnHand : 0, qtyConsumed: result ? result.qtyConsumed : 0 };
  }
  const all = await ConsignmentStock.aggregate([
    { $match: match },
    { $group: {
      _id: '$supplierId',
      outstanding: { $sum: { $subtract: ['$liabilityAmount', '$liabilitySettled'] } },
      qtyOnHand: { $sum: '$qtyOnHand' },
      qtyConsumed: { $sum: '$qtyConsumed' },
    } },
  ]);
  return all.map((r) => ({ supplierId: r._id, outstanding: r.outstanding, qtyOnHand: r.qtyOnHand, qtyConsumed: r.qtyConsumed }));
}

async function listConsignmentStock(companyId, { supplierId, warehouseId, productId } = {}) {
  const filter = { companyId };
  if (supplierId) filter.supplierId = supplierId;
  if (warehouseId) filter.warehouseId = warehouseId;
  if (productId) filter.productId = productId;
  return ConsignmentStock.find(filter).sort({ receivedAt: -1 });
}

module.exports = {
  consumeConsignmentStock,
  settleConsignmentLiability,
  getOutstandingConsignmentLiability,
  listConsignmentStock,
};
