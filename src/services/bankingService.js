/**
 * BankingService — the "Payment & Banking" module: reconciliation against a
 * bank/wallet statement, transfers between two internal payment accounts
 * (e.g. cash deposited to bank), and voucher reversals. All three post
 * through the same AccountingService.postVoucher() (or, for reconciliation,
 * just mark existing vouchers — reconciliation never creates new financial
 * entries, it only confirms which ones already cleared).
 */
const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const Account = require('../models/Account');
const BankReconciliation = require('../models/BankReconciliation');
const accountingService = require('./accountingService');
const auditService = require('./auditService');
const { nextDocumentNumber } = require('./numberingService');

// --- Account transfers (e.g. cash deposited to bank) ---------------------

/** Moves money between two of the company's own payment accounts. Dr toAccount, Cr fromAccount. */
async function transferBetweenAccounts({ companyId, branchId, fromAccountId, toAccountId, amount, date, note, userId }) {
  if (fromAccountId === toAccountId) throw new Error('fromAccountId and toAccountId must be different.');
  if (!amount || amount <= 0) throw new Error('Transfer amount must be greater than zero.');

  return accountingService.postVoucher({
    companyId, branchId, type: 'contra', date: date || new Date(),
    narration: note || 'Internal account transfer',
    entries: [
      { accountId: toAccountId, debit: amount, credit: 0 },
      { accountId: fromAccountId, debit: 0, credit: amount },
    ],
    userId,
  });
}

// --- Voucher reversal -----------------------------------------------------

/** Creates a new voucher with debit/credit swapped from the original, and links both together. Original is never edited or deleted. */
async function reverseVoucher(voucherId, { userId, reason }) {
  const session = await mongoose.startSession();
  try {
    let reversal;
    await session.withTransaction(async () => {
      const original = await Voucher.findById(voucherId).session(session);
      if (!original) throw new Error('Voucher not found.');
      if (original.reversedByVoucherId) throw new Error('This voucher has already been reversed.');

      [reversal] = await Voucher.create(
        [{
          companyId: original.companyId, branchId: original.branchId,
          voucherNumber: nextDocumentNumber('REV'),
          type: original.type, date: new Date(),
          narration: `Reversal of ${original.voucherNumber}: ${reason || ''}`,
          reversesVoucherId: original._id,
          userId,
          entries: original.entries.map((e) => ({ accountId: e.accountId, debit: e.credit, credit: e.debit })),
        }],
        { session }
      );

      original.reversedByVoucherId = reversal._id;
      original.reversedAt = new Date();
      await original.save({ session });

      await auditService.record({
        companyId: original.companyId, userId, action: 'voucher.reversed',
        entityType: 'Voucher', entityId: original._id, metadata: { reversalVoucherId: reversal._id, reason },
      }, session);
    });
    return reversal;
  } finally {
    session.endSession();
  }
}

// --- Bank reconciliation ---------------------------------------------------

function startReconciliation({ companyId, accountId, statementDate, statementBalance, userId }) {
  return BankReconciliation.create({ companyId, accountId, statementDate, statementBalance, userId });
}

async function markCleared(reconciliationId, voucherIds) {
  const reconciliation = await BankReconciliation.findByIdAndUpdate(
    reconciliationId,
    { $addToSet: { clearedVoucherIds: { $each: voucherIds } } },
    { new: true }
  );
  if (!reconciliation) throw new Error('Reconciliation not found.');
  return reconciliation;
}

/** Opening balance + every voucher entry on `accountId` up to (and including) `asOfDate` — the "what the books say the balance is" figure reconciliation checks against the bank's own number. Shared by completeReconciliation and the statement-import summary. */
async function computeBookBalance(companyId, accountId, asOfDate) {
  const account = await Account.findById(accountId);
  if (!account) throw new Error('Account not found.');

  const totals = await Voucher.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), date: { $lte: asOfDate } } },
    { $unwind: '$entries' },
    { $match: { 'entries.accountId': new mongoose.Types.ObjectId(accountId) } },
    { $group: { _id: null, debit: { $sum: '$entries.debit' }, credit: { $sum: '$entries.credit' } } },
  ]);
  return account.openingBalance + (totals[0]?.debit || 0) - (totals[0]?.credit || 0);
}

/** Completes the reconciliation, computing the book balance (opening + all vouchers on the account up to statementDate) vs the entered statement balance. */
async function completeReconciliation(reconciliationId) {
  const reconciliation = await BankReconciliation.findById(reconciliationId);
  if (!reconciliation) throw new Error('Reconciliation not found.');
  if (reconciliation.status === 'completed') throw new Error('Already completed.');

  const bookBalance = await computeBookBalance(reconciliation.companyId, reconciliation.accountId, reconciliation.statementDate);

  reconciliation.status = 'completed';
  reconciliation.bookBalanceAtCompletion = Math.round(bookBalance * 100) / 100;
  reconciliation.difference = Math.round((bookBalance - reconciliation.statementBalance) * 100) / 100;
  reconciliation.completedAt = new Date();
  await reconciliation.save();

  return reconciliation;
}

/** Vouchers touching this account, in the reconciliation's date range, flagged cleared/uncleared: the actual working list a bookkeeper checks off against the paper statement. */
async function reconciliationDetail(reconciliationId) {
  const reconciliation = await BankReconciliation.findById(reconciliationId);
  if (!reconciliation) throw new Error('Reconciliation not found.');

  const vouchers = await Voucher.find({
    companyId: reconciliation.companyId, date: { $lte: reconciliation.statementDate },
    'entries.accountId': reconciliation.accountId,
  }).sort({ date: 1 });

  const clearedSet = new Set(reconciliation.clearedVoucherIds.map(String));

  return {
    reconciliation,
    vouchers: vouchers.map((v) => ({
      voucherId: v._id, voucherNumber: v.voucherNumber, date: v.date, narration: v.narration,
      cleared: clearedSet.has(String(v._id)),
    })),
  };
}

module.exports = {
  transferBetweenAccounts, reverseVoucher,
  startReconciliation, markCleared, completeReconciliation, reconciliationDetail,
  computeBookBalance,
};
