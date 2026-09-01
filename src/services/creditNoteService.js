/**
 * CreditNoteService — the formal accounting document for reducing what a
 * customer owes. Distinct from SaleReturn (a physical stock movement):
 * issueCreditNote() never touches inventory, only posts the real ledger
 * impact (Dr Sales Revenue, Cr Accounts Receivable) exactly the way
 * saleReturnService reverses revenue on a return — a credit note is that
 * same accounting reversal, just not gated behind stock actually coming
 * back. A return-triggered note can still link back via saleReturnId.
 */
const mongoose = require('mongoose');
const CreditNote = require('../models/CreditNote');
const Sale = require('../models/Sale');
const accountingService = require('./accountingService');
const defaultAccountsService = require('./defaultAccountsService');
const auditService = require('./auditService');
const { nextDocumentNumber } = require('./numberingService');

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} [input.branchId]
 * @param {String} input.customerId
 * @param {Number} input.amount
 * @param {String} [input.saleId] - original invoice this note relates to, if any
 * @param {String} [input.saleReturnId] - the SaleReturn this note is the accounting side of, if any
 * @param {String} [input.reason]
 * @param {String} [input.arAccountId] - override for the receivable account credited
 * @param {String} [input.revenueAccountId] - override for the revenue account debited
 * @param {String} [input.userId]
 */
async function issueCreditNote(input) {
  const { companyId, branchId, customerId, amount, saleId, saleReturnId, reason, userId } = input;
  if (!customerId) throw new Error('customerId is required.');
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');

  let resolvedBranchId = branchId;
  if (saleId) {
    const sale = await Sale.findOne({ _id: saleId, companyId });
    if (!sale) throw new Error('Sale not found.');
    if (amount > sale.totalAmount + 0.01) {
      throw new Error(`Credit note amount ${amount} exceeds the invoice total of ${sale.totalAmount}.`);
    }
    resolvedBranchId = resolvedBranchId || sale.branchId;
  }

  const arAccountId = input.arAccountId || (await defaultAccountsService.resolve(companyId, 'accountsReceivableId'));
  const revenueAccountId = input.revenueAccountId || (await defaultAccountsService.resolve(companyId, 'salesRevenueId'));
  if (!arAccountId) throw new Error('No Accounts Receivable account configured for this company.');
  if (!revenueAccountId) throw new Error('No Sales Revenue account configured for this company.');

  const session = await mongoose.startSession();
  try {
    let creditNote;
    await session.withTransaction(async () => {
      [creditNote] = await CreditNote.create(
        [{
          companyId, branchId: resolvedBranchId, noteNumber: nextDocumentNumber('CN'),
          customerId, saleId: saleId || null, saleReturnId: saleReturnId || null,
          reason: reason || '', amount, arAccountId, revenueAccountId, issuedBy: userId,
        }],
        { session }
      );

      // Dr Sales Revenue, Cr Accounts Receivable — reverses the income and
      // reduces what the customer owes, without touching stock.
      await accountingService.postVoucher({
        companyId, branchId: resolvedBranchId, type: 'journal',
        narration: `Credit note ${creditNote.noteNumber}${reason ? `: ${reason}` : ''}`,
        entries: [
          { accountId: revenueAccountId, debit: amount, credit: 0 },
          { accountId: arAccountId, debit: 0, credit: amount },
        ],
        referenceType: 'CreditNote', referenceId: creditNote._id, userId,
      }, session);

      await auditService.record({
        companyId, userId, action: 'credit_note.issued', entityType: 'CreditNote', entityId: creditNote._id,
        metadata: { noteNumber: creditNote.noteNumber, amount, customerId },
      }, session);
    });
    return creditNote;
  } finally {
    session.endSession();
  }
}

function listCreditNotes(companyId, { customerId, status, saleId } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  if (saleId) filter.saleId = saleId;
  return CreditNote.find(filter).sort({ createdAt: -1 });
}

/** Marks a note as consumed against a specific future sale, a bookkeeping marker only; the actual reduction of that sale's due amount is the caller's (sale/payment flow's) responsibility. */
async function applyCreditNote(id, { saleId, userId, companyId }) {
  const note = await CreditNote.findOne({ _id: id, companyId });
  if (!note) throw new Error('Credit note not found.');
  if (note.status !== 'issued') throw new Error(`Cannot apply a credit note with status "${note.status}".`);
  if (!saleId) throw new Error('saleId is required.');

  const sale = await Sale.findOne({ _id: saleId, companyId });
  if (!sale) throw new Error('Sale not found.');

  note.status = 'applied';
  note.appliedToSaleId = saleId;
  note.appliedAt = new Date();
  await note.save();

  await auditService.record({
    companyId, userId, action: 'credit_note.applied', entityType: 'CreditNote', entityId: note._id,
    metadata: { noteNumber: note.noteNumber, appliedToSaleId: saleId },
  });

  return note;
}

async function voidCreditNote(id, { userId, companyId, reason }) {
  const note = await CreditNote.findOne({ _id: id, companyId });
  if (!note) throw new Error('Credit note not found.');
  if (note.status === 'void') throw new Error('This credit note is already void.');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Reverse the original posting: Dr Accounts Receivable, Cr Sales Revenue.
      await accountingService.postVoucher({
        companyId, branchId: note.branchId, type: 'journal',
        narration: `Void credit note ${note.noteNumber}${reason ? `: ${reason}` : ''}`,
        entries: [
          { accountId: note.arAccountId, debit: note.amount, credit: 0 },
          { accountId: note.revenueAccountId, debit: 0, credit: note.amount },
        ],
        referenceType: 'CreditNote', referenceId: note._id, userId,
      }, session);

      note.status = 'void';
      note.voidedAt = new Date();
      note.voidReason = reason || '';
      await note.save({ session });

      await auditService.record({
        companyId, userId, action: 'credit_note.voided', entityType: 'CreditNote', entityId: note._id,
        metadata: { noteNumber: note.noteNumber, reason },
      }, session);
    });
    return note;
  } finally {
    session.endSession();
  }
}

module.exports = { issueCreditNote, listCreditNotes, applyCreditNote, voidCreditNote };
