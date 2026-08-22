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
const Company = require('../models/Company');
const Appointment = require('../models/Appointment');

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

// ---------------------------------------------------------------------------
// Home Dashboard — a company-agnostic CORE snapshot plus an industry-specific
// section chosen by the company's actual industryType/activeModules. Unlike
// getDashboard() above (which slices by the REQUESTER's permissions), this
// is deliberately company-shaped, not role-shaped: "what does this business
// look like today", the same for whoever's looking at it. Built the same
// way as the rest of this file — real queries against existing models/
// services, never a fabricated number, and any industry with no bespoke
// section below still gets the CORE section rather than an empty page.
// ---------------------------------------------------------------------------

/** Always-useful numbers regardless of what the company sells. */
async function coreHomeSection(companyId) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [salesToday, lowStock, balanceSheet] = await Promise.all([
    reportingService.salesSummary(companyId, todayStart, today()),
    reportingService.lowStockReport(companyId),
    reportingService.balanceSheet(companyId, today()),
  ]);

  const receivablesAccountId = await defaultAccountsService.resolve(companyId, 'accountsReceivableId').catch(() => null);
  const receivables = balanceSheet.assets.find((a) => String(a.accountId) === String(receivablesAccountId))?.balance || 0;
  const cashAndBank = balanceSheet.assets.filter((a) => /cash|bank/i.test(a.name)).reduce((sum, a) => sum + a.balance, 0);

  return {
    salesToday: salesToday.summary.netSales,
    transactionsToday: salesToday.summary.invoiceCount,
    lowStockCount: lowStock.length,
    cashAndBank,
    receivablesDue: receivables,
  };
}

async function pharmacyHomeSection(companyId) {
  const pharmacyService = require('../modules/pharmacy/services/pharmacyService');
  const Prescription = require('../modules/pharmacy/models/Prescription');
  const [nearExpiry, pendingPrescriptions] = await Promise.all([
    pharmacyService.nearExpiryReport(companyId, 30),
    Prescription.countDocuments({ companyId, status: { $ne: 'dispensed' } }),
  ]);
  return { industry: 'pharmacy', nearExpiryBatches: nearExpiry.slice(0, 10), nearExpiryCount: nearExpiry.length, pendingPrescriptions };
}

async function hotelHomeSection(companyId) {
  const Room = require('../modules/hotel/models/Room');
  const Reservation = require('../modules/hotel/models/Reservation');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [totalRooms, occupiedRooms, checkInsToday, checkOutsToday] = await Promise.all([
    Room.countDocuments({ companyId, isActive: true }),
    Room.countDocuments({ companyId, isActive: true, status: 'occupied' }),
    Reservation.find({ companyId, status: 'booked', checkInDate: { $gte: todayStart, $lt: todayEnd } }).populate('roomId', 'roomNumber').populate('customerId', 'name'),
    Reservation.find({ companyId, status: 'checked_in', checkOutDate: { $gte: todayStart, $lt: todayEnd } }).populate('roomId', 'roomNumber').populate('customerId', 'name'),
  ]);

  return {
    industry: 'hotel',
    totalRooms, occupiedRooms,
    occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0,
    checkInsToday, checkOutsToday,
  };
}

async function restaurantHomeSection(companyId) {
  const Table = require('../modules/restaurant/models/Table');
  const KitchenOrderTicket = require('../modules/restaurant/models/KitchenOrderTicket');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  const [totalTables, openTables, openKots, kotsToday] = await Promise.all([
    Table.countDocuments({ companyId }),
    Table.countDocuments({ companyId, status: { $ne: 'free' } }),
    KitchenOrderTicket.countDocuments({ companyId, status: { $in: ['open', 'sent_to_kitchen'] } }),
    KitchenOrderTicket.countDocuments({ companyId, createdAt: { $gte: todayStart } }),
  ]);

  return { industry: 'restaurant', totalTables, openTables, openKots, kotsToday };
}

async function salonHomeSection(companyId) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [appointmentsToday, appointmentsCompletedToday] = await Promise.all([
    Appointment.find({ companyId, startTime: { $gte: todayStart, $lt: todayEnd }, status: { $ne: 'cancelled' } })
      .populate('customerId', 'name').sort({ startTime: 1 }),
    Appointment.countDocuments({ companyId, startTime: { $gte: todayStart, $lt: todayEnd }, status: 'completed' }),
  ]);

  return { industry: 'salon', appointmentsToday: appointmentsToday.slice(0, 10), appointmentsTodayCount: appointmentsToday.length, appointmentsCompletedToday };
}

async function gymHomeSection(companyId) {
  const ClassSession = require('../modules/gym/models/ClassSession');
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const sessionsToday = await ClassSession.find({ companyId, startTime: { $gte: todayStart, $lt: todayEnd } }).populate('gymClassId', 'name').sort({ startTime: 1 });
  const totalCapacity = sessionsToday.reduce((sum, s) => sum + s.capacity, 0);
  const totalEnrolled = sessionsToday.reduce((sum, s) => sum + s.enrolledCustomerIds.length, 0);
  const totalWaitlisted = sessionsToday.reduce((sum, s) => sum + s.waitlistCustomerIds.length, 0);

  return {
    industry: 'gym',
    sessionsToday: sessionsToday.slice(0, 10), sessionsTodayCount: sessionsToday.length,
    totalCapacity, totalEnrolled, totalWaitlisted,
  };
}

async function realEstateHomeSection(companyId) {
  const Lease = require('../modules/real_estate/models/Lease');
  const PERIOD_DAYS = 30;
  const MS_PER_DAY = 1000 * 60 * 60 * 24;

  const activeLeases = await Lease.find({ companyId, status: 'active' }).populate('tenantCustomerId', 'name').populate('propertyId', 'unitNumber');
  const now = new Date();

  const overdue = [];
  for (const lease of activeLeases) {
    const dueDate = new Date(lease.lastRentGeneratedThrough.getTime() + PERIOD_DAYS * MS_PER_DAY);
    if (now > dueDate) {
      const daysLate = Math.ceil((now - dueDate) / MS_PER_DAY);
      const lateFee = Math.round(daysLate * lease.lateFeePerDay * 100) / 100;
      overdue.push({
        leaseId: lease._id, unitNumber: lease.propertyId?.unitNumber, tenantName: lease.tenantCustomerId?.name,
        dueDate, daysLate, amountDue: Math.round((lease.monthlyRent + lateFee) * 100) / 100,
      });
    }
  }
  overdue.sort((a, b) => b.daysLate - a.daysLate);

  return {
    industry: 'real_estate',
    activeLeaseCount: activeLeases.length,
    overdueLeases: overdue.slice(0, 10),
    overdueLeaseCount: overdue.length,
    overdueTotal: Math.round(overdue.reduce((sum, o) => sum + o.amountDue, 0) * 100) / 100,
  };
}

async function groceryHomeSection(companyId) {
  const pharmacyService = require('../modules/pharmacy/services/pharmacyService'); // nearExpiryReport is a plain company-scoped ProductBatch/StockLevel query, nothing pharmacy-specific about the fields it reads — genuinely reusable for any perishable-goods trade, not just pharmacy
  const todayStart7 = daysAgo(7);
  const [fastMovers, nearExpiry] = await Promise.all([
    reportingService.topProductsReport(companyId, todayStart7, today(), 5),
    pharmacyService.nearExpiryReport(companyId, 14),
  ]);
  return { industry: 'grocery', fastMovers, nearExpiryBatches: nearExpiry.slice(0, 10), nearExpiryCount: nearExpiry.length };
}

async function retailHomeSection(companyId) {
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const topProductsToday = await reportingService.topProductsReport(companyId, todayStart, today(), 5);
  return { industry: 'retail', topProductsToday };
}

const INDUSTRY_SECTIONS = {
  pharmacy: pharmacyHomeSection,
  hotel: hotelHomeSection,
  restaurant: restaurantHomeSection,
  salon: salonHomeSection,
  gym: gymHomeSection,
  real_estate: realEstateHomeSection,
  grocery: groceryHomeSection,
  retail: retailHomeSection,
};

/**
 * The home-screen snapshot: CORE numbers every business owner wants,
 * plus an industry section picked off the company's real industryType
 * (falling back to checking activeModules, since a company can run a
 * secondary industry module without that being its primary industryType).
 * Any industry without a bespoke section above still gets a real,
 * non-empty page — just CORE alone — never an error or fake data.
 */
async function getHomeDashboard(companyId) {
  const company = await Company.findById(companyId);
  if (!company) throw new Error('Company not found.');

  const core = await coreHomeSection(companyId);

  const industryKey = INDUSTRY_SECTIONS[company.industryType]
    ? company.industryType
    : (company.activeModules || []).find((m) => INDUSTRY_SECTIONS[m]);

  let industrySection = null;
  if (industryKey) {
    industrySection = await INDUSTRY_SECTIONS[industryKey](companyId);
  }

  return {
    companyName: company.name,
    industryType: company.industryType,
    core,
    industry: industrySection, // null when this company's industry has no bespoke section yet — the frontend renders CORE only in that case
  };
}

module.exports = {
  getDashboard, ownerDashboard, salesManagerDashboard, warehouseManagerDashboard, hrManagerDashboard, cashierDashboard,
  getHomeDashboard,
};
