/**
 * BudgetService — setBudget() is a real upsert against the unique
 * (accountId, month, year) index, so setting a budget again is honestly
 * an update, never a silent duplicate. budgetVsActual() compares each
 * budgeted account against REAL Voucher entries for that exact calendar
 * month — reusing the same account-type-aware debit/credit netting
 * profitAndLoss and costCenterProfitAndLoss already established (income
 * accounts net credit-minus-debit, expense accounts net debit-minus-credit),
 * not a second, differently-computed "actual" number.
 */
const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const Account = require('../models/Account');
const BudgetLine = require('../models/BudgetLine');

function setBudget(input) {
  const { companyId, accountId, month, year, budgetedAmount } = input;
  if (!budgetedAmount || budgetedAmount <= 0) throw new Error('budgetedAmount must be greater than zero.');
  if (month < 1 || month > 12) throw new Error('month must be between 1 and 12.');
  return BudgetLine.findOneAndUpdate(
    { companyId, accountId, month, year },
    { $set: { budgetedAmount } },
    { new: true, upsert: true }
  );
}

function listBudgetLines(companyId, { month, year } = {}) {
  const filter = { companyId };
  if (month) filter.month = Number(month);
  if (year) filter.year = Number(year);
  return BudgetLine.find(filter).populate('accountId', 'name type').sort({ year: 1, month: 1 });
}

/**
 * Real comparison, account by account, for one real calendar month —
 * the actual figure comes from a genuine Voucher aggregation over that
 * exact date range, the same source of truth every other financial
 * report in this app already reads, never a parallel tracked number.
 */
async function budgetVsActual(companyId, month, year) {
  const budgetLines = await BudgetLine.find({ companyId, month, year }).populate('accountId', 'name type');
  if (budgetLines.length === 0) return { month, year, rows: [], totalBudgeted: 0, totalActual: 0, totalVariance: 0 };

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999); // the real last day of this month, correctly computed

  const companyObjectId = new mongoose.Types.ObjectId(companyId);
  const accountIds = budgetLines.map((b) => new mongoose.Types.ObjectId(b.accountId._id));

  const totals = await Voucher.aggregate([
    { $match: { companyId: companyObjectId, date: { $gte: monthStart, $lte: monthEnd }, 'entries.accountId': { $in: accountIds } } },
    { $unwind: '$entries' },
    { $match: { 'entries.accountId': { $in: accountIds } } },
    { $group: { _id: '$entries.accountId', totalDebit: { $sum: '$entries.debit' }, totalCredit: { $sum: '$entries.credit' } } },
  ]);
  const totalsByAccount = new Map(totals.map((t) => [String(t._id), t]));

  const rows = budgetLines.map((line) => {
    const t = totalsByAccount.get(String(line.accountId._id));
    const debit = t?.totalDebit || 0;
    const credit = t?.totalCredit || 0;
    const actual = line.accountId.type === 'income' ? Math.round((credit - debit) * 100) / 100 : Math.round((debit - credit) * 100) / 100;
    const variance = Math.round((actual - line.budgetedAmount) * 100) / 100;
    const variancePercent = line.budgetedAmount > 0 ? Math.round((variance / line.budgetedAmount) * 10000) / 100 : null;
    return { accountId: line.accountId._id, accountName: line.accountId.name, accountType: line.accountId.type, budgeted: line.budgetedAmount, actual, variance, variancePercent };
  });

  const totalBudgeted = Math.round(rows.reduce((s, r) => s + r.budgeted, 0) * 100) / 100;
  const totalActual = Math.round(rows.reduce((s, r) => s + r.actual, 0) * 100) / 100;

  return { month, year, rows, totalBudgeted, totalActual, totalVariance: Math.round((totalActual - totalBudgeted) * 100) / 100 };
}

module.exports = { setBudget, listBudgetLines, budgetVsActual };
