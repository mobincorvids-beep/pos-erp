/**
 * CostCenterService — costCenterProfitAndLoss() reuses profitAndLoss's
 * exact aggregation shape (group ledger entries by accountId, look up
 * each account's type to bucket into income/expense), with the one real
 * addition: entries are filtered to ONLY those actually tagged with the
 * requested cost center. The correctness that actually matters here: a
 * single voucher can have entries belonging to DIFFERENT cost centers
 * (e.g. one leg debiting a cost-center-tagged expense, the other
 * crediting an untagged cash account) — the filter has to operate at the
 * individual entry level, not the whole voucher, or a cost center's P&L
 * would silently pick up money that was never actually tagged to it.
 */
const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const Account = require('../models/Account');
const CostCenter = require('../models/CostCenter');

// See reportingService.js's endOfDay for why this exists: `to` is a plain
// "YYYY-MM-DD" string, and new Date(to) alone parses to midnight UTC (the
// START of that day) — a $lte bound against it would silently drop every
// voucher dated later that same day.
function endOfDay(dateStr) {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function createCostCenter(input) {
  const { companyId, name, code } = input;
  return CostCenter.create({ companyId, name, code });
}

function listCostCenters(companyId) {
  return CostCenter.find({ companyId, isActive: true });
}

async function costCenterProfitAndLoss(companyId, costCenterId, from, to) {
  const costCenter = await CostCenter.findById(costCenterId);
  if (!costCenter) throw new Error('Cost center not found.');

  const companyObjectId = new mongoose.Types.ObjectId(companyId);
  const costCenterObjectId = new mongoose.Types.ObjectId(costCenterId);

  const totals = await Voucher.aggregate([
    // Matched once at the voucher level first (a real index-friendly
    // pre-filter — a voucher can't possibly qualify if none of its
    // entries carry this cost center at all).
    { $match: { companyId: companyObjectId, date: { $gte: new Date(from), $lte: endOfDay(to) }, 'entries.costCenterId': costCenterObjectId } },
    { $unwind: '$entries' },
    // The REAL filter — now operating on individual unwound entries, so
    // a voucher's OTHER entries (tagged to a different cost center, or
    // not tagged at all) are correctly excluded even though they live in
    // the same voucher document.
    { $match: { 'entries.costCenterId': costCenterObjectId } },
    { $group: { _id: '$entries.accountId', totalDebit: { $sum: '$entries.debit' }, totalCredit: { $sum: '$entries.credit' } } },
  ]);

  const totalsByAccount = new Map(totals.map((t) => [String(t._id), t]));
  const accounts = await Account.find({ companyId, type: { $in: ['income', 'expense'] }, isActive: true });

  const income = [];
  const expenses = [];
  for (const account of accounts) {
    const t = totalsByAccount.get(String(account._id));
    if (!t) continue; // this cost center never touched this account — don't list a zero row for every account in the whole chart
    const debit = t.totalDebit || 0;
    const credit = t.totalCredit || 0;
    if (account.type === 'income') income.push({ accountId: account._id, name: account.name, amount: Math.round((credit - debit) * 100) / 100 });
    else expenses.push({ accountId: account._id, name: account.name, amount: Math.round((debit - credit) * 100) / 100 });
  }

  const totalIncome = Math.round(income.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;
  const totalExpenses = Math.round(expenses.reduce((sum, e) => sum + e.amount, 0) * 100) / 100;

  return { costCenter: { id: costCenter._id, name: costCenter.name }, from, to, income, expenses, totalIncome, totalExpenses, netProfit: Math.round((totalIncome - totalExpenses) * 100) / 100 };
}

module.exports = { createCostCenter, listCostCenters, costCenterProfitAndLoss };
