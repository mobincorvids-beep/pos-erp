/**
 * PeriodService — the real enforcement behind Fiscal Years/Accounting
 * Periods: assertPeriodOpen() is the one function accountingService.
 * postVoucher() calls, and it's deliberately written so that a company
 * with zero AccountingPeriod documents (every single scenario that
 * existed before this feature) gets a query that can never match
 * anything — a genuine no-op, not a behavior change disguised as one.
 */
const FiscalYear = require('../models/FiscalYear');
const AccountingPeriod = require('../models/AccountingPeriod');

function createFiscalYear(input) {
  const { companyId, name, startDate, endDate } = input;
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');
  return FiscalYear.create({ companyId, name, startDate, endDate });
}

/** A real, genuinely missing read endpoint, createFiscalYear() existed with no way to list what had already been created, which a period-creation form needs to let someone pick which fiscal year a new period belongs to. */
function listFiscalYears(companyId) {
  return FiscalYear.find({ companyId }).sort({ startDate: -1 });
}

function createAccountingPeriod(input) {
  const { companyId, fiscalYearId, name, startDate, endDate } = input;
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');
  return AccountingPeriod.create({ companyId, fiscalYearId, name, startDate, endDate });
}

function listAccountingPeriods(companyId) {
  return AccountingPeriod.find({ companyId }).populate('fiscalYearId', 'name').sort({ startDate: 1 });
}

async function closePeriod(periodId) {
  const period = await AccountingPeriod.findById(periodId);
  if (!period) throw new Error('Accounting period not found.');
  period.status = 'closed';
  await period.save();
  return period;
}

async function reopenPeriod(periodId) {
  const period = await AccountingPeriod.findById(periodId);
  if (!period) throw new Error('Accounting period not found.');
  period.status = 'open';
  await period.save();
  return period;
}

/**
 * The real guard — a fast, indexed, read-only query for a CLOSED period
 * whose date range covers the voucher's own date. If none exists (either
 * no periods are defined at all, or the covering period is still open),
 * this resolves silently and postVoucher proceeds exactly as it always has.
 */
async function assertPeriodOpen(companyId, date) {
  const closedPeriod = await AccountingPeriod.findOne({ companyId, status: 'closed', startDate: { $lte: date }, endDate: { $gte: date } });
  if (closedPeriod) {
    throw new Error(`Cannot post a voucher dated ${new Date(date).toDateString()}, the accounting period "${closedPeriod.name}" covering this date is closed.`);
  }
}

module.exports = { createFiscalYear, listFiscalYears, createAccountingPeriod, listAccountingPeriods, closePeriod, reopenPeriod, assertPeriodOpen };
