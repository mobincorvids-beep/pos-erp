/**
 * ExpenseService — submission + approval workflow. An expense is just a
 * record until approved; approveExpense() is the only function that touches
 * the ledger, via the same AccountingService.postVoucher() every other
 * module uses, so expenses never get their own bookkeeping shortcut.
 */
const mongoose = require('mongoose');
const Expense = require('../models/Expense');
const ExpenseCategory = require('../models/ExpenseCategory');
const ProjectCost = require('../models/ProjectCost');
const accountingService = require('./accountingService');

async function submitExpense(input) {
  const { companyId, branchId, categoryId, paymentAccountId, amount, date, note, userId, projectId } = input;
  if (!amount || amount <= 0) throw new Error('Expense amount must be greater than zero.');

  const category = await ExpenseCategory.findOne({ _id: categoryId, companyId });
  if (!category) throw new Error('Expense category not found for this company.');

  return Expense.create({
    companyId, branchId, categoryId, paymentAccountId, amount,
    date: date || new Date(), note, userId, status: 'pending', projectId: projectId || null,
  });
}

async function approveExpense(expenseId, approverUserId) {
  const session = await mongoose.startSession();
  try {
    let expense;

    await session.withTransaction(async () => {
      expense = await Expense.findById(expenseId).session(session);
      if (!expense) throw new Error('Expense not found.');
      if (expense.status !== 'pending') throw new Error(`Cannot approve an expense with status "${expense.status}".`);

      const category = await ExpenseCategory.findById(expense.categoryId).session(session);
      if (!category) throw new Error('Expense category no longer exists.');

      const voucher = await accountingService.postVoucher({
        companyId: expense.companyId,
        branchId: expense.branchId,
        type: 'payment',
        date: expense.date,
        narration: `Expense approved: ${category.name}${expense.note ? ' — ' + expense.note : ''}`,
        entries: [
          { accountId: category.accountId, debit: expense.amount, credit: 0 },       // Dr Expense
          { accountId: expense.paymentAccountId, debit: 0, credit: expense.amount }, // Cr Cash/Bank
        ],
        referenceType: 'Expense',
        referenceId: expense._id,
        userId: approverUserId,
      }, session);

      expense.status = 'approved';
      expense.approvedBy = approverUserId;
      expense.approvedAt = new Date();
      expense.voucherId = voucher._id;
      await expense.save({ session });

      // Job costing interlink: an expense tagged with a project
      // automatically becomes a ProjectCost the moment it's approved — no
      // separate re-entry into the Projects module, and it can't happen
      // twice since approval is a one-way status transition guarded above.
      if (expense.projectId) {
        await ProjectCost.create(
          [{
            companyId: expense.companyId, projectId: expense.projectId, type: 'expense',
            amount: expense.amount, referenceType: 'Expense', referenceId: expense._id,
            date: expense.date, note: expense.note, userId: approverUserId,
          }],
          { session }
        );
      }
    });

    return expense;
  } finally {
    session.endSession();
  }
}

async function rejectExpense(expenseId, approverUserId, reason) {
  const expense = await Expense.findById(expenseId);
  if (!expense) throw new Error('Expense not found.');
  if (expense.status !== 'pending') throw new Error(`Cannot reject an expense with status "${expense.status}".`);

  expense.status = 'rejected';
  expense.approvedBy = approverUserId;
  expense.approvedAt = new Date();
  expense.rejectionReason = reason || null;
  await expense.save();

  return expense;
}

module.exports = { submitExpense, approveExpense, rejectExpense };
