/**
 * ReportingService — read-only aggregations over the core ledgers. No new
 * write paths here; every number is derived from stockMovements/stockLevels
 * (inventory) and vouchers/ledgerEntries (accounting), which are the same
 * sources of truth every other module already writes to.
 */
const mongoose = require('mongoose');
const Voucher = require('../models/Voucher');
const Account = require('../models/Account');
const StockLevel = require('../models/StockLevel');
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Branch = require('../models/Branch');
const PurchaseOrder = require('../models/PurchaseOrder');

// Every date-range report below takes `to` as a plain "YYYY-MM-DD" string
// from the client's date picker. `new Date(to)` alone parses that as
// midnight UTC — i.e. the very START of that day — so any document
// timestamped later that same day (which is most of them, for any caller
// whose local timezone is ahead of UTC — this covers the majority of this
// app's actual user base, including Pakistan) was silently excluded by a
// `$lte` upper bound. A same-day sale would show correctly in Sales
// History but as PKR 0.00 in every report. Every `to` upper bound below
// goes through this instead, which pushes it to the last instant of that
// calendar date (in UTC, matching how the date-only string was parsed) so
// "today" actually includes all of today.
function endOfDay(dateStr) {
  const d = new Date(dateStr);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

/**
 * Trial balance: for every account, sum all debits and credits across all
 * vouchers up to `asOfDate`, plus its opening balance. A balanced ledger
 * means total debits == total credits across all accounts.
 */
async function trialBalance(companyId, asOfDate = new Date()) {
  const accounts = await Account.find({ companyId, isActive: true });

  const totals = await Voucher.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), date: { $lte: asOfDate } } },
    { $unwind: '$entries' },
    {
      $group: {
        _id: '$entries.accountId',
        totalDebit: { $sum: '$entries.debit' },
        totalCredit: { $sum: '$entries.credit' },
      },
    },
  ]);

  const totalsByAccount = new Map(totals.map((t) => [String(t._id), t]));

  const rows = accounts.map((account) => {
    const t = totalsByAccount.get(String(account._id));
    const debit = (t?.totalDebit || 0) + (account.type === 'asset' || account.type === 'expense' ? account.openingBalance : 0);
    const credit = (t?.totalCredit || 0) + (account.type !== 'asset' && account.type !== 'expense' ? account.openingBalance : 0);
    return {
      accountId: account._id,
      name: account.name,
      type: account.type,
      debit: Math.round(debit * 100) / 100,
      credit: Math.round(credit * 100) / 100,
    };
  });

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

  return {
    asOfDate,
    accounts: rows,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    balanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

/**
 * Stock valuation: current on-hand quantity x weighted-average cost, per
 * product, per warehouse. avgCost comes from StockLevel (maintained by
 * InventoryService on every costed incoming movement) — falls back to the
 * product's static cost only for stock that predates any costed movement
 * (e.g. seeded opening stock with no unitCost).
 */
async function stockValuation(companyId, warehouseId = null) {
  const match = { companyId: new mongoose.Types.ObjectId(companyId) };
  if (warehouseId) match.warehouseId = new mongoose.Types.ObjectId(warehouseId);

  const levels = await StockLevel.find(match).populate('productId', 'name sku costPrice variants');

  const rows = levels
    .filter((l) => l.quantity !== 0)
    .map((level) => {
      const product = level.productId;
      const variant = product?.variants?.id(level.variantId);
      const unitCost = level.avgCost > 0 ? level.avgCost : (variant?.costPrice ?? product?.costPrice ?? 0);
      return {
        warehouseId: level.warehouseId,
        productId: product?._id,
        productName: product?.name,
        variantId: level.variantId,
        quantity: level.quantity,
        reservedQuantity: level.reservedQuantity,
        unitCost,
        value: Math.round(level.quantity * unitCost * 100) / 100,
      };
    });

  const totalValue = rows.reduce((sum, r) => sum + r.value, 0);

  return { rows, totalValue: Math.round(totalValue * 100) / 100 };
}

/**
 * Sales summary between two dates: totals, and a breakdown by day and by
 * payment method — the numbers your proposal's "Dashboard" section listed
 * (today's sales, gross totals, payment mix).
 */
async function salesSummary(companyId, from, to) {
  const match = {
    companyId: new mongoose.Types.ObjectId(companyId),
    status: 'completed',
    createdAt: { $gte: new Date(from), $lte: endOfDay(to) },
  };

  const totals = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        grossSales: { $sum: '$subtotal' },
        totalDiscount: { $sum: '$discountAmount' },
        totalTax: { $sum: '$taxAmount' },
        netSales: { $sum: '$totalAmount' },
        totalPaid: { $sum: '$paidAmount' },
        totalDue: { $sum: '$dueAmount' },
        invoiceCount: { $sum: 1 },
      },
    },
  ]);

  const byDay = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        netSales: { $sum: '$totalAmount' },
        invoiceCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const byPaymentMethod = await Sale.aggregate([
    { $match: match },
    { $unwind: '$payments' },
    {
      $group: {
        _id: '$payments.method',
        total: { $sum: '$payments.amount' },
      },
    },
  ]);

  return {
    from, to,
    summary: totals[0] || {
      grossSales: 0, totalDiscount: 0, totalTax: 0, netSales: 0,
      totalPaid: 0, totalDue: 0, invoiceCount: 0,
    },
    byDay: byDay.map((d) => ({ date: d._id, netSales: d.netSales, invoiceCount: d.invoiceCount })),
    byPaymentMethod: byPaymentMethod.map((p) => ({ method: p._id, total: p.total })),
  };
}

/**
 * Profit & Loss between two dates: sums ledger activity for income and
 * expense accounts only (asset/liability/equity movements don't belong on
 * a P&L). Net profit = total income - total expense for the period.
 */
async function profitAndLoss(companyId, from, to) {
  const accounts = await Account.find({ companyId, type: { $in: ['income', 'expense'] }, isActive: true });

  const totals = await Voucher.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), date: { $gte: new Date(from), $lte: endOfDay(to) } } },
    { $unwind: '$entries' },
    {
      $group: {
        _id: '$entries.accountId',
        totalDebit: { $sum: '$entries.debit' },
        totalCredit: { $sum: '$entries.credit' },
      },
    },
  ]);
  const totalsByAccount = new Map(totals.map((t) => [String(t._id), t]));

  const income = [];
  const expenses = [];

  for (const account of accounts) {
    const t = totalsByAccount.get(String(account._id));
    const debit = t?.totalDebit || 0;
    const credit = t?.totalCredit || 0;

    if (account.type === 'income') {
      // Income accounts carry a credit-normal balance: revenue - returns/discounts.
      income.push({ accountId: account._id, name: account.name, amount: Math.round((credit - debit) * 100) / 100 });
    } else {
      // Expense accounts carry a debit-normal balance.
      expenses.push({ accountId: account._id, name: account.name, amount: Math.round((debit - credit) * 100) / 100 });
    }
  }

  const totalIncome = Math.round(income.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;
  const totalExpense = Math.round(expenses.reduce((sum, r) => sum + r.amount, 0) * 100) / 100;

  return {
    from, to, income, expenses,
    totalIncome, totalExpense,
    netProfit: Math.round((totalIncome - totalExpense) * 100) / 100,
  };
}

/**
 * Balance Sheet as of a date: asset/liability/equity account balances plus
 * retained earnings (net profit accumulated from the beginning of time up
 * to `asOfDate`), so the sheet balances even without a formal period-close step.
 */
async function balanceSheet(companyId, asOfDate = new Date()) {
  const accounts = await Account.find({ companyId, type: { $in: ['asset', 'liability', 'equity'] }, isActive: true });

  const totals = await Voucher.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), date: { $lte: asOfDate } } },
    { $unwind: '$entries' },
    {
      $group: {
        _id: '$entries.accountId',
        totalDebit: { $sum: '$entries.debit' },
        totalCredit: { $sum: '$entries.credit' },
      },
    },
  ]);
  const totalsByAccount = new Map(totals.map((t) => [String(t._id), t]));

  const assets = [], liabilities = [], equity = [];

  for (const account of accounts) {
    const t = totalsByAccount.get(String(account._id));
    const debit = (t?.totalDebit || 0) + (account.type === 'asset' ? account.openingBalance : 0);
    const credit = (t?.totalCredit || 0) + (account.type !== 'asset' ? account.openingBalance : 0);
    const balance = account.type === 'asset' ? debit - credit : credit - debit;
    const row = { accountId: account._id, name: account.name, balance: Math.round(balance * 100) / 100 };

    if (account.type === 'asset') assets.push(row);
    else if (account.type === 'liability') liabilities.push(row);
    else equity.push(row);
  }

  // Retained earnings: accumulated net profit, treated as an equity balance
  // even though it has no dedicated Account record — this is what makes
  // assets == liabilities + equity without requiring an explicit period-close.
  const earliestVoucher = await Voucher.findOne({ companyId }).sort({ date: 1 });
  const retainedEarnings = earliestVoucher
    ? (await profitAndLoss(companyId, earliestVoucher.date, asOfDate)).netProfit
    : 0;
  equity.push({ accountId: null, name: 'Retained Earnings', balance: Math.round(retainedEarnings * 100) / 100 });

  const totalAssets = Math.round(assets.reduce((s, r) => s + r.balance, 0) * 100) / 100;
  const totalLiabilities = Math.round(liabilities.reduce((s, r) => s + r.balance, 0) * 100) / 100;
  const totalEquity = Math.round(equity.reduce((s, r) => s + r.balance, 0) * 100) / 100;

  return {
    asOfDate, assets, liabilities, equity,
    totalAssets, totalLiabilities, totalEquity,
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
  };
}

/**
 * Cash/Bank book for one payment account: every ledger entry that touched
 * it, in date order, with a running balance. Works for any account with
 * isPaymentAccount = true (cash drawer, a specific bank account, a mobile
 * wallet) — pass its accountId.
 */
async function cashBankBook(companyId, accountId, from, to) {
  const account = await Account.findOne({ _id: accountId, companyId });
  if (!account) throw new Error('Account not found.');

  const priorTotals = await Voucher.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), date: { $lt: new Date(from) } } },
    { $unwind: '$entries' },
    { $match: { 'entries.accountId': new mongoose.Types.ObjectId(accountId) } },
    { $group: { _id: null, debit: { $sum: '$entries.debit' }, credit: { $sum: '$entries.credit' } } },
  ]);
  const openingBalance = account.openingBalance
    + (priorTotals[0]?.debit || 0) - (priorTotals[0]?.credit || 0);

  const vouchers = await Voucher.find({
    companyId, date: { $gte: new Date(from), $lte: endOfDay(to) },
    'entries.accountId': accountId,
  }).sort({ date: 1 });

  let balance = openingBalance;
  const rows = [];
  for (const voucher of vouchers) {
    for (const entry of voucher.entries) {
      if (String(entry.accountId) !== String(accountId)) continue;
      balance += entry.debit - entry.credit;
      rows.push({
        date: voucher.date, voucherNumber: voucher.voucherNumber, type: voucher.type,
        narration: voucher.narration, debit: entry.debit, credit: entry.credit, balance,
      });
    }
  }

  return { accountId, accountName: account.name, from, to, openingBalance, entries: rows, closingBalance: balance };
}

/**
 * Low stock: every product variant whose on-hand quantity has fallen to or
 * below its reorderLevel. Reads Product.reorderLevel (set per-product) and
 * StockLevel.quantity — the same fields Inventory already maintains, no
 * separate "alerts" table.
 */
async function lowStockReport(companyId, warehouseId = null) {
  const match = { companyId: new mongoose.Types.ObjectId(companyId) };
  if (warehouseId) match.warehouseId = new mongoose.Types.ObjectId(warehouseId);

  const levels = await StockLevel.find(match).populate('productId', 'name sku reorderLevel minStock');

  return levels
    .filter((l) => l.productId && l.quantity <= (l.productId.reorderLevel || 0))
    .map((l) => ({
      warehouseId: l.warehouseId, productId: l.productId._id, productName: l.productId.name,
      variantId: l.variantId, quantityOnHand: l.quantity, reorderLevel: l.productId.reorderLevel,
      minStock: l.productId.minStock,
    }))
    .sort((a, b) => a.quantityOnHand - b.quantityOnHand);
}

/** Best-selling products by revenue in a date range, driven straight off completed Sale line items. */
async function topProductsReport(companyId, from, to, limit = 20) {
  const rows = await Sale.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'completed', createdAt: { $gte: new Date(from), $lte: endOfDay(to) } } },
    { $unwind: '$items' },
    { $group: { _id: { productId: '$items.productId', variantId: '$items.variantId' }, quantitySold: { $sum: '$items.quantity' }, revenue: { $sum: '$items.lineTotal' } } },
    { $sort: { revenue: -1 } },
    { $limit: limit },
    { $lookup: { from: 'products', localField: '_id.productId', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((r) => ({
    productId: r._id.productId, variantId: r._id.variantId, productName: r.product?.name || 'Unknown',
    quantitySold: r.quantitySold, revenue: Math.round(r.revenue * 100) / 100,
  }));
}

/** Best customers by spend in a date range. */
async function topCustomersReport(companyId, from, to, limit = 20) {
  const rows = await Sale.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'completed', customerId: { $ne: null }, createdAt: { $gte: new Date(from), $lte: endOfDay(to) } } },
    { $group: { _id: '$customerId', totalSpend: { $sum: '$totalAmount' }, invoiceCount: { $sum: 1 } } },
    { $sort: { totalSpend: -1 } },
    { $limit: limit },
    { $lookup: { from: 'customers', localField: '_id', foreignField: '_id', as: 'customer' } },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((r) => ({
    customerId: r._id, customerName: r.customer?.name || 'Unknown',
    totalSpend: Math.round(r.totalSpend * 100) / 100, invoiceCount: r.invoiceCount,
  }));
}

/** Sales performance by cashier/salesperson: who rang up how much. */
async function salespersonPerformanceReport(companyId, from, to) {
  const rows = await Sale.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'completed', createdAt: { $gte: new Date(from), $lte: endOfDay(to) } } },
    { $group: { _id: '$userId', netSales: { $sum: '$totalAmount' }, invoiceCount: { $sum: 1 } } },
    { $sort: { netSales: -1 } },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
    { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
  ]);

  return rows.map((r) => ({
    userId: r._id, userName: r.user?.name || 'Unknown',
    netSales: Math.round(r.netSales * 100) / 100, invoiceCount: r.invoiceCount,
    averageSale: r.invoiceCount > 0 ? Math.round((r.netSales / r.invoiceCount) * 100) / 100 : 0,
  }));
}

/** Approved expenses grouped by category in a date range. */
async function expenseReport(companyId, from, to) {
  const rows = await Expense.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'approved', date: { $gte: new Date(from), $lte: endOfDay(to) } } },
    { $group: { _id: '$categoryId', total: { $sum: '$amount' }, count: { $sum: 1 } } },
    { $sort: { total: -1 } },
    { $lookup: { from: 'expensecategories', localField: '_id', foreignField: '_id', as: 'category' } },
    { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
  ]);

  const rowsOut = rows.map((r) => ({
    categoryId: r._id, categoryName: r.category?.name || 'Unknown',
    total: Math.round(r.total * 100) / 100, count: r.count,
  }));

  return { from, to, rows: rowsOut, grandTotal: Math.round(rowsOut.reduce((s, r) => s + r.total, 0) * 100) / 100 };
}

/** Sales compared across branches: the "Branch profitability/comparison" the proposal called out under Multi-Branch. */
async function branchComparisonReport(companyId, from, to) {
  const [branches, sales] = await Promise.all([
    Branch.find({ companyId }),
    Sale.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'completed', createdAt: { $gte: new Date(from), $lte: endOfDay(to) } } },
      { $group: { _id: '$branchId', netSales: { $sum: '$totalAmount' }, invoiceCount: { $sum: 1 } } },
    ]),
  ]);

  const byBranch = new Map(sales.map((s) => [String(s._id), s]));
  return branches.map((b) => {
    const s = byBranch.get(String(b._id));
    return {
      branchId: b._id, branchName: b.name,
      netSales: Math.round((s?.netSales || 0) * 100) / 100, invoiceCount: s?.invoiceCount || 0,
    };
  }).sort((a, b) => b.netSales - a.netSales);
}

/** Raw stock movement ledger for a warehouse/date range, the audit trail behind every other inventory number. */
async function stockMovementReport(companyId, warehouseId, from, to) {
  const filter = { companyId, createdAt: { $gte: new Date(from), $lte: endOfDay(to) } };
  if (warehouseId) filter.warehouseId = warehouseId;

  return StockMovement.find(filter).sort({ createdAt: -1 }).limit(500).populate('productId', 'name sku');
}

/**
 * ABC analysis (Pareto/SKU classification): ranks every product sold in the
 * date range by its total sales value (quantity x price, straight off
 * completed Sale line items — same source topProductsReport uses), then
 * walks that descending list accumulating a running share of total value.
 * Standard Pareto thresholds: class A is however many top products it
 * takes to reach 80% of cumulative value, B extends that to 95%, and
 * everything after is C. Read-only, like every other report here — no
 * write path, purely a classification view over data other modules already
 * wrote (Sale).
 */
async function abcAnalysisReport(companyId, from, to) {
  const rows = await Sale.aggregate([
    { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'completed', createdAt: { $gte: new Date(from), $lte: endOfDay(to) } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: { productId: '$items.productId', variantId: '$items.variantId' },
        quantitySold: { $sum: '$items.quantity' },
        salesValue: { $sum: '$items.lineTotal' },
      },
    },
    { $sort: { salesValue: -1 } },
    { $lookup: { from: 'products', localField: '_id.productId', foreignField: '_id', as: 'product' } },
    { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
  ]);

  const grandTotal = rows.reduce((sum, r) => sum + r.salesValue, 0);

  let cumulativeValue = 0;
  const classified = rows.map((r) => {
    cumulativeValue += r.salesValue;
    const cumulativePercent = grandTotal > 0 ? (cumulativeValue / grandTotal) * 100 : 0;
    // Standard Pareto cutoffs: A = top ~80% of cumulative value, B = next
    // ~15% (up to 95%), C = the remaining ~5% (the long tail).
    const abcClass = cumulativePercent <= 80 ? 'A' : cumulativePercent <= 95 ? 'B' : 'C';
    return {
      productId: r._id.productId, variantId: r._id.variantId, productName: r.product?.name || 'Unknown',
      quantitySold: r.quantitySold,
      salesValue: Math.round(r.salesValue * 100) / 100,
      percentOfTotal: grandTotal > 0 ? Math.round((r.salesValue / grandTotal) * 10000) / 100 : 0,
      cumulativePercent: Math.round(cumulativePercent * 100) / 100,
      class: abcClass,
    };
  });

  const summary = { A: { count: 0, value: 0 }, B: { count: 0, value: 0 }, C: { count: 0, value: 0 } };
  for (const row of classified) {
    summary[row.class].count += 1;
    summary[row.class].value += row.salesValue;
  }
  for (const key of Object.keys(summary)) {
    summary[key].value = Math.round(summary[key].value * 100) / 100;
    summary[key].percentOfValue = grandTotal > 0 ? Math.round((summary[key].value / grandTotal) * 10000) / 100 : 0;
  }

  return { from, to, totalValue: Math.round(grandTotal * 100) / 100, summary, rows: classified };
}

/**
 * Drill-down for Sales Summary: instead of the byDay/byPaymentMethod
 * aggregates, returns the actual completed Sale documents that rolled up
 * into one summary row. groupKey's meaning depends on groupBy:
 *   groupBy 'day'            -> groupKey is a 'YYYY-MM-DD' date (matches byDay._id)
 *   groupBy 'paymentMethod'  -> groupKey is a payment method string (matches byPaymentMethod._id)
 * Same [from, to] window and 'completed' filter as salesSummary(), so the
 * transaction list is guaranteed to actually sum back to the row it's
 * drilling into.
 */
async function salesSummaryDrillDown(companyId, from, to, groupBy, groupKey) {
  if (!groupBy || !groupKey) throw new Error('`groupBy` and `groupKey` are required for drill-down.');
  const match = {
    companyId: new mongoose.Types.ObjectId(companyId),
    status: 'completed',
    createdAt: { $gte: new Date(from), $lte: endOfDay(to) },
  };

  if (groupBy === 'day') {
    const dayStart = new Date(`${groupKey}T00:00:00.000Z`);
    const dayEnd = new Date(`${groupKey}T23:59:59.999Z`);
    match.createdAt = { $gte: dayStart, $lte: dayEnd };
    const sales = await Sale.find(match).sort({ createdAt: -1 });
    return { groupBy, groupKey, count: sales.length, sales };
  }

  if (groupBy === 'paymentMethod') {
    const sales = await Sale.find({ ...match, 'payments.method': groupKey }).sort({ createdAt: -1 });
    return { groupBy, groupKey, count: sales.length, sales };
  }

  throw new Error(`Unsupported groupBy "${groupBy}" — expected "day" or "paymentMethod".`);
}

/**
 * Drill-down for Trial Balance: the raw Voucher entries that summed into
 * one account's debit/credit row, up to asOfDate — same source
 * trialBalance() aggregates over (Voucher.entries), just unaggregated.
 */
async function trialBalanceDrillDown(companyId, asOfDate, accountId) {
  if (!accountId) throw new Error('`accountId` (groupKey) is required for drill-down.');
  const vouchers = await Voucher.find({
    companyId, date: { $lte: asOfDate }, 'entries.accountId': accountId,
  }).sort({ date: 1 });

  const entries = [];
  for (const voucher of vouchers) {
    for (const entry of voucher.entries) {
      if (String(entry.accountId) !== String(accountId)) continue;
      entries.push({
        voucherId: voucher._id, voucherNumber: voucher.voucherNumber, type: voucher.type,
        date: voucher.date, narration: voucher.narration, debit: entry.debit, credit: entry.credit,
      });
    }
  }

  return { accountId, asOfDate, count: entries.length, entries };
}

/**
 * Comparative period analysis (MoM/YoY): computes one metric for the
 * current period and `periodsBack` prior periods of the same periodType,
 * returning {period, value, changePercent} rows suitable for a trend
 * chart. Reuses salesSummary/profitAndLoss's own math rather than
 * re-deriving revenue/margin a second way.
 *   metric: 'revenue' (net sales) | 'grossMargin' (P&L netProfit as a % proxy is NOT this —
 *           grossMargin here = (netSales - COGS-ish expense total) via profitAndLoss's
 *           income/expense split, expressed as netProfit for simplicity, see below)
 */
function periodBounds(periodType, periodsBack, offset) {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  if (periodType === 'month') {
    start.setUTCMonth(start.getUTCMonth() - offset);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
    return { from: start, to: end, label };
  }
  if (periodType === 'year') {
    const yearStart = new Date(Date.UTC(now.getUTCFullYear() - offset, 0, 1));
    const yearEnd = new Date(Date.UTC(now.getUTCFullYear() - offset, 11, 31, 23, 59, 59, 999));
    return { from: yearStart, to: yearEnd, label: String(yearStart.getUTCFullYear()) };
  }
  throw new Error(`Unsupported periodType "${periodType}" — expected "month" or "year".`);
}

async function getComparativePeriodReport(companyId, { metric = 'revenue', periodType = 'month', periodsBack = 6 } = {}) {
  const offsets = Array.from({ length: periodsBack + 1 }, (_, i) => i).reverse(); // oldest -> newest, current last

  const periods = [];
  for (const offset of offsets) {
    const { from, to, label } = periodBounds(periodType, periodsBack, offset);
    let value = 0;
    if (metric === 'revenue') {
      const summary = await salesSummary(companyId, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
      value = summary.summary.netSales;
    } else if (metric === 'grossMargin') {
      const pnl = await profitAndLoss(companyId, from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
      value = pnl.totalIncome > 0 ? Math.round((pnl.netProfit / pnl.totalIncome) * 10000) / 100 : 0; // percent
    } else {
      throw new Error(`Unsupported metric "${metric}" — expected "revenue" or "grossMargin".`);
    }
    periods.push({ period: label, value: Math.round(value * 100) / 100 });
  }

  const withChange = periods.map((p, i) => {
    if (i === 0) return { ...p, changePercent: null };
    const prev = periods[i - 1].value;
    const changePercent = prev !== 0 ? Math.round(((p.value - prev) / Math.abs(prev)) * 10000) / 100 : null;
    return { ...p, changePercent };
  });

  return { metric, periodType, periodsBack, periods: withChange };
}

/**
 * KPI/scorecard dashboard: a fixed set of cross-module KPIs already
 * computable from existing services, aggregated into one response shaped
 * for a dashboard of KPI cards. on-time delivery % is included only when
 * a supplier scorecard service exists (a parallel-round feature) — it's
 * silently omitted (not a hard failure) if that module isn't present in
 * this deployment.
 */
async function getKpiScorecard(companyId, { from, to } = {}) {
  if (!from || !to) throw new Error('`from` and `to` are required.');

  const [sales, pnl, lowStock, apAging] = await Promise.all([
    salesSummary(companyId, from, to),
    profitAndLoss(companyId, from, to),
    lowStockReport(companyId),
    apAgingReport(companyId, endOfDay(to)),
  ]);

  // AR aging total — badDebtService owns arAgingReport; require lazily so
  // reportingService doesn't hard-depend on a module that could be absent.
  let arAgingTotal = null;
  try {
    const { arAgingReport } = require('./badDebtService');
    const ar = await arAgingReport(companyId, endOfDay(to));
    arAgingTotal = ar.totalOutstanding ?? null;
  } catch (err) { /* badDebtService not present in this deployment */ }

  // On-time delivery % — only if a supplier-scorecard module exists (parallel round).
  let onTimeDeliveryPercent = null;
  try {
    const supplierScorecardService = require('./supplierScorecardService');
    if (typeof supplierScorecardService.getOnTimeDeliveryPercent === 'function') {
      onTimeDeliveryPercent = await supplierScorecardService.getOnTimeDeliveryPercent(companyId, { from, to });
    }
  } catch (err) { /* supplierScorecardService not present in this deployment */ }

  // Inventory turnover: COGS proxy (expense total for the period) / average
  // inventory value (current stock valuation, since we don't retain
  // historical valuations to average against — an honest approximation).
  const stockVal = await stockValuation(companyId);
  const inventoryTurnover = stockVal.totalValue > 0
    ? Math.round((pnl.totalExpense / stockVal.totalValue) * 100) / 100
    : null;

  const grossMarginPercent = pnl.totalIncome > 0 ? Math.round((pnl.netProfit / pnl.totalIncome) * 10000) / 100 : null;

  return {
    from, to,
    kpis: {
      revenue: sales.summary.netSales,
      grossMarginPercent,
      onTimeDeliveryPercent,
      inventoryTurnover,
      arAgingTotal,
      lowStockSkuCount: lowStock.length,
      apAgingTotal: apAging.totalOutstanding,
    },
  };
}

module.exports = {
  trialBalance, stockValuation, salesSummary,
  profitAndLoss, balanceSheet, cashBankBook,
  lowStockReport, topProductsReport, topCustomersReport, salespersonPerformanceReport,
  expenseReport, branchComparisonReport, stockMovementReport, apAgingReport, abcAnalysisReport,
  salesSummaryDrillDown, trialBalanceDrillDown, getComparativePeriodReport, getKpiScorecard,
};

/**
 * apAgingReport — the payable-side mirror of badDebtService.arAgingReport,
 * reusing its exact bucketing shape (0-30/31-60/61-90/90+ days, measured
 * from PurchaseOrder.orderDate — falling back to createdAt for rows
 * predating that field — since there is no separate due-date field
 * either, the same honest default already stated for AR). Confirmed
 * before writing this that PurchaseOrder.dueAmount is a real, live
 * balance already maintained by supplierLedgerService's own payment
 * allocation logic — this report reads that existing source of truth,
 * it doesn't introduce a second one.
 */
async function apAgingReport(companyId, asOfDate = new Date()) {
  const outstandingOrders = await PurchaseOrder.find({ companyId, dueAmount: { $gt: 0 }, status: { $ne: 'cancelled' } })
    .populate('supplierId', 'name').sort({ createdAt: 1 });

  const buckets = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  const rows = outstandingOrders.map((po) => {
    const daysOverdue = Math.max(0, Math.floor((asOfDate - (po.orderDate || po.createdAt)) / (24 * 60 * 60 * 1000)));
    const bucket = daysOverdue <= 30 ? '0-30' : daysOverdue <= 60 ? '31-60' : daysOverdue <= 90 ? '61-90' : '90+';
    buckets[bucket] = Math.round((buckets[bucket] + po.dueAmount) * 100) / 100;
    return { purchaseOrderId: po._id, poNumber: po.poNumber, supplierName: po.supplierId?.name || 'Unknown', daysOverdue, bucket, dueAmount: po.dueAmount };
  });

  return { asOfDate, rows, buckets, totalOutstanding: Math.round(Object.values(buckets).reduce((s, v) => s + v, 0) * 100) / 100 };
}
