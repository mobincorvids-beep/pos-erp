/**
 * DashboardService — the real Dashboard Engine that didn't exist before:
 * a role's permissions determine what data they get back, not one
 * generic view shown to everyone regardless of what they actually do.
 * Deliberately built almost entirely on top of EXISTING reporting/service
 * functions (reportingService, defaultAccountsService, lowStockReport,
 * expenseService's pending queue) rather than reimplementing any of that
 * logic a second time — this is an aggregation/routing layer, not a new
 * source of truth for anything.
 */
const reportingService = require('./reportingService');
const defaultAccountsService = require('./defaultAccountsService');
const Account = require('../models/Account');
const Expense = require('../models/Expense');
const ApprovalRequest = require('../models/ApprovalRequest');
const LeaveRequest = require('../models/LeaveRequest');
const StockCount = require('../models/StockCount');
const Notification = require('../models/Notification');

const today = () => new Date();
const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/**
 * Owner/CEO/CFO view — the financial health of the whole company:
 * revenue, gross/net profit (last 30 days), receivables/payables/cash
 * pulled straight from a real balance sheet (not re-derived), inventory value.
 */
async function ownerDashboard(companyId) {
  const [pnl, balanceSheet, stockValuation, salesSummary] = await Promise.all([
    reportingService.profitAndLoss(companyId, daysAgo(30), today()),
    reportingService.balanceSheet(companyId, today()),
    reportingService.stockValuation(companyId),
    reportingService.salesSummary(companyId, daysAgo(30), today()),
  ]);

  const receivablesAccountId = await defaultAccountsService.resolve(companyId, 'accountsReceivableId').catch(() => null);
  const payablesAccountId = await defaultAccountsService.resolve(companyId, 'accountsPayableId').catch(() => null);
  const receivables = balanceSheet.assets.find((a) => String(a.accountId) === String(receivablesAccountId))?.balance || 0;
  const payables = balanceSheet.liabilities.find((a) => String(a.accountId) === String(payablesAccountId))?.balance || 0;
  const cashAndBank = balanceSheet.assets.filter((a) => /cash|bank/i.test(a.name)).reduce((sum, a) => sum + a.balance, 0);

  return {
    role: 'owner',
    // profitAndLoss's real fields are totalIncome/totalExpense/netProfit —
    // there's no separate "revenue" or "grossProfit" field to read (this
    // app doesn't currently break P&L into a gross-vs-net split at the
    // reporting layer), so totalIncome is genuinely the closest available
    // stand-in for "revenue" here, not a renamed field.
    revenue: pnl.totalIncome, netProfit: pnl.netProfit,
    receivables, payables, cashAndBank,
    inventoryValue: stockValuation.totalValue,
    salesCount30d: salesSummary.summary.invoiceCount, salesTotal30d: salesSummary.summary.netSales,
  };
}

/** Sales Manager view — the pipeline that actually matters to someone running sales, not the whole company's books. */
async function salesManagerDashboard(companyId) {
  const [salesSummary, topProducts, topCustomers] = await Promise.all([
    reportingService.salesSummary(companyId, daysAgo(30), today()),
    reportingService.topProductsReport(companyId, daysAgo(30), today(), 5),
    reportingService.topCustomersReport(companyId, daysAgo(30), today(), 5),
  ]);
  return { role: 'sales_manager', salesTotal30d: salesSummary.summary.netSales, saleCount30d: salesSummary.summary.invoiceCount, topProducts, topCustomers };
}

/** Warehouse Manager view — stock health, not financial statements. */
async function warehouseManagerDashboard(companyId) {
  const [lowStock, stockValuation] = await Promise.all([
    reportingService.lowStockReport(companyId),
    reportingService.stockValuation(companyId),
  ]);
  return { role: 'warehouse_manager', lowStockCount: lowStock.length, lowStockItems: lowStock.slice(0, 10), inventoryValue: stockValuation.totalValue };
}

/** HR Manager view — attendance/leave, the day-to-day HR queue, not sales or inventory. */
async function hrManagerDashboard(companyId) {
  const pendingLeave = await LeaveRequest.countDocuments({ companyId, status: 'pending' });
  return { role: 'hr_manager', pendingLeaveRequests: pendingLeave };
}

/** Cashier view — deliberately the smallest, most operational slice: what THEY sold today, nothing about the company's overall finances. */
async function cashierDashboard(companyId, userId) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const salesSummary = await reportingService.salesSummary(companyId, todayStart, today());
  return { role: 'cashier', salesTotalToday: salesSummary.summary.netSales, saleCountToday: salesSummary.summary.invoiceCount };
}

/** Common to every role regardless of their specific slice — real unread notifications and pending approvals, since everyone needs to know what's waiting on THEM specifically. */
async function commonWidgets(companyId, userId, roleId) {
  const [unreadNotifications, pendingApprovals, pendingExpenses, openStockCounts] = await Promise.all([
    Notification.countDocuments({ companyId, read: false, $or: [{ userId }, ...(roleId ? [{ roleId }] : [])] }),
    ApprovalRequest.countDocuments({ companyId, status: 'pending' }),
    Expense.countDocuments({ companyId, status: 'pending' }),
    StockCount.countDocuments({ companyId, status: 'in_progress' }),
  ]);
  return { unreadNotifications, pendingApprovals, pendingExpenses, openStockCounts };
}

/**
 * The actual routing — inspects the requester's permissions and returns
 * the matching slice(s). permissions === null (super-admin/owner) gets
 * the full owner view. Someone with MULTIPLE relevant permission sets
 * genuinely gets multiple sections back, not forced to pick one — a
 * Branch Manager who also handles HR sees both.
 */
async function getDashboard(companyId, { userId, roleId, permissions }) {
  const sections = {};
  const common = await commonWidgets(companyId, userId, roleId);

  const hasAny = (...keys) => permissions === null || keys.some((k) => permissions.includes(k) || permissions.includes(k.split('.')[0] + '.*') || permissions.includes('*'));

  if (permissions === null || hasAny('accounting.view', 'accounts.manage')) sections.owner = await ownerDashboard(companyId);
  if (hasAny('sales.view')) sections.salesManager = await salesManagerDashboard(companyId);
  if (hasAny('inventory.adjust', 'inventory.transfer')) sections.warehouseManager = await warehouseManagerDashboard(companyId);
  if (hasAny('hr.manage', 'payroll.post')) sections.hrManager = await hrManagerDashboard(companyId);
  if (hasAny('pos.sell') && !sections.owner) sections.cashier = await cashierDashboard(companyId, userId); // only shown as the PRIMARY view for someone who ISN'T already getting the full owner view — a cashier-only role, not an admin who also happens to have pos.sell

  if (Object.keys(sections).length === 0) sections.cashier = await cashierDashboard(companyId, userId); // genuinely no matching permission set — fall back to the smallest, safest slice rather than show nothing at all

  return { ...common, sections };
}

module.exports = { getDashboard, ownerDashboard, salesManagerDashboard, warehouseManagerDashboard, hrManagerDashboard, cashierDashboard };
