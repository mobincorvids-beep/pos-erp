/**
 * DebitNoteService — the purchasing-side mirror of creditNoteService.
 * issueDebitNote() posts the real ledger impact (Dr Accounts Payable, Cr
 * Inventory/Expense) reducing what the company owes a supplier, without
 * requiring a physical goods return — a pricing dispute, a short-shipment
 * credit, a billing correction can all be issued standalone.
 */
const mongoose = require('mongoose');
const DebitNote = require('../models/DebitNote');
const PurchaseOrder = require('../models/PurchaseOrder');
const accountingService = require('./accountingService');
const defaultAccountsService = require('./defaultAccountsService');
const auditService = require('./auditService');
const { nextDocumentNumber } = require('./numberingService');

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} [input.branchId]
 * @param {String} input.supplierId
 * @param {Number} input.amount
 * @param {String} [input.purchaseOrderId]
 * @param {String} [input.reason]
 * @param {String} [input.apAccountId] - override for the payable account debited
 * @param {String} [input.expenseAccountId] - override for the inventory/expense account credited
 * @param {String} [input.userId]
 */
async function issueDebitNote(input) {
  const { companyId, branchId, supplierId, amount, purchaseOrderId, reason, userId } = input;
  if (!supplierId) throw new Error('supplierId is required.');
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');

  let resolvedBranchId = branchId;
  if (purchaseOrderId) {
    const po = await PurchaseOrder.findOne({ _id: purchaseOrderId, companyId });
    if (!po) throw new Error('Purchase order not found.');
    if (amount > po.totalAmount + 0.01) {
      throw new Error(`Debit note amount ${amount} exceeds the purchase order total of ${po.totalAmount}.`);
    }
    resolvedBranchId = resolvedBranchId || po.branchId;
  }

  const apAccountId = input.apAccountId || (await defaultAccountsService.resolve(companyId, 'accountsPayableId'));
  const expenseAccountId = input.expenseAccountId || (await defaultAccountsService.resolve(companyId, 'inventoryAssetId'));
  if (!apAccountId) throw new Error('No Accounts Payable account configured for this company.');
  if (!expenseAccountId) throw new Error('No Inventory/Expense account configured for this company.');

  const session = await mongoose.startSession();
  try {
    let debitNote;
    await session.withTransaction(async () => {
      [debitNote] = await DebitNote.create(
        [{
          companyId, branchId: resolvedBranchId, noteNumber: nextDocumentNumber('DN'),
          supplierId, purchaseOrderId: purchaseOrderId || null,
          reason: reason || '', amount, apAccountId, expenseAccountId, issuedBy: userId,
        }],
        { session }
      );

      // Dr Accounts Payable, Cr Inventory/Expense — reduces what's owed to
      // the supplier and reverses the original cost, without touching stock.
      await accountingService.postVoucher({
        companyId, branchId: resolvedBranchId, type: 'journal',
        narration: `Debit note ${debitNote.noteNumber}${reason ? `: ${reason}` : ''}`,
        entries: [
          { accountId: apAccountId, debit: amount, credit: 0 },
          { accountId: expenseAccountId, debit: 0, credit: amount },
        ],
        referenceType: 'DebitNote', referenceId: debitNote._id, userId,
      }, session);

      if (purchaseOrderId) {
        await PurchaseOrder.updateOne(
          { _id: purchaseOrderId },
          { $inc: { dueAmount: -amount } },
          { session }
        );
      }

      await auditService.record({
        companyId, userId, action: 'debit_note.issued', entityType: 'DebitNote', entityId: debitNote._id,
        metadata: { noteNumber: debitNote.noteNumber, amount, supplierId },
      }, session);
    });
    return debitNote;
  } finally {
    session.endSession();
  }
}

function listDebitNotes(companyId, { supplierId, status, purchaseOrderId } = {}) {
  const filter = { companyId };
  if (supplierId) filter.supplierId = supplierId;
  if (status) filter.status = status;
  if (purchaseOrderId) filter.purchaseOrderId = purchaseOrderId;
  return DebitNote.find(filter).sort({ createdAt: -1 });
}

async function voidDebitNote(id, { userId, companyId, reason }) {
  const note = await DebitNote.findOne({ _id: id, companyId });
  if (!note) throw new Error('Debit note not found.');
  if (note.status === 'void') throw new Error('This debit note is already void.');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // Reverse the original posting: Dr Inventory/Expense, Cr Accounts Payable.
      await accountingService.postVoucher({
        companyId, branchId: note.branchId, type: 'journal',
        narration: `Void debit note ${note.noteNumber}${reason ? `: ${reason}` : ''}`,
        entries: [
          { accountId: note.expenseAccountId, debit: note.amount, credit: 0 },
          { accountId: note.apAccountId, debit: 0, credit: note.amount },
        ],
        referenceType: 'DebitNote', referenceId: note._id, userId,
      }, session);

      if (note.purchaseOrderId) {
        await PurchaseOrder.updateOne(
          { _id: note.purchaseOrderId },
          { $inc: { dueAmount: note.amount } },
          { session }
        );
      }

      note.status = 'void';
      note.voidedAt = new Date();
      note.voidReason = reason || '';
      await note.save({ session });

      await auditService.record({
        companyId, userId, action: 'debit_note.voided', entityType: 'DebitNote', entityId: note._id,
        metadata: { noteNumber: note.noteNumber, reason },
      }, session);
    });
    return note;
  } finally {
    session.endSession();
  }
}

module.exports = { issueDebitNote, listDebitNotes, voidDebitNote };
