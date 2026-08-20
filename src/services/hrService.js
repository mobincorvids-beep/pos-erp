/**
 * HrService — employees, attendance, leave, and attendance-driven payroll.
 * generatePayroll() reads real Attendance records to compute per-employee
 * deductions (not a flat guess), and postPayroll() writes one voucher
 * through AccountingService — the same "reuse the core accounting engine"
 * rule every other module follows, so payroll shows up in the P&L and
 * cash/bank book like any other expense.
 */
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const PayrollRun = require('../models/PayrollRun');
const Account = require('../models/Account');
const accountingService = require('./accountingService');
const auditService = require('./auditService');
const defaultAccountsService = require('./defaultAccountsService');
const mongoose = require('mongoose');

// --- Employees -----------------------------------------------------------

function createEmployee(input) {
  const { companyId, branchId, departmentId, userId, name, designation, phone, joiningDate, salaryStructure } = input;
  if (!name) throw new Error('Employee name is required.');
  return Employee.create({ companyId, branchId, departmentId, userId, name, designation, phone, joiningDate, salaryStructure });
}

async function terminateEmployee(employeeId) {
  const employee = await Employee.findByIdAndUpdate(
    employeeId, { status: 'terminated', terminatedAt: new Date() }, { new: true }
  );
  if (!employee) throw new Error('Employee not found.');
  return employee;
}

// --- Attendance ------------------------------------------------------------

/** Marks (or corrects) one day's attendance. Upsert so re-marking the same day updates rather than duplicates (unique index on employeeId+date backs this). */
function markAttendance({ companyId, employeeId, date, status, checkIn, checkOut, note }) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return Attendance.findOneAndUpdate(
    { employeeId, date: day },
    { companyId, employeeId, date: day, status, checkIn, checkOut, note },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

function attendanceForMonth(employeeId, month, year) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);
  return Attendance.find({ employeeId, date: { $gte: from, $lte: to } }).sort({ date: 1 });
}

// --- Leave ------------------------------------------------------------------

function requestLeave({ companyId, employeeId, fromDate, toDate, type, reason }) {
  if (new Date(fromDate) > new Date(toDate)) throw new Error('fromDate must be before toDate.');
  return LeaveRequest.create({ companyId, employeeId, fromDate, toDate, type, reason });
}

async function decideLeave(leaveRequestId, { approve, userId }) {
  const leave = await LeaveRequest.findById(leaveRequestId);
  if (!leave) throw new Error('Leave request not found.');
  if (leave.status !== 'pending') throw new Error(`Already ${leave.status}.`);

  leave.status = approve ? 'approved' : 'rejected';
  leave.approvedBy = userId;
  leave.approvedAt = new Date();
  await leave.save();

  // An approved leave marks each covered day as 'leave' attendance, so
  // payroll's absence-day count is automatically consistent with leave
  // records — a payroll run never has to cross-reference both.
  if (approve) {
    const days = [];
    for (let d = new Date(leave.fromDate); d <= leave.toDate; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }
    for (const day of days) {
      await markAttendance({ companyId: leave.companyId, employeeId: leave.employeeId, date: day, status: 'leave', note: `Leave: ${leave.type}` });
    }
  }

  return leave;
}

// --- Payroll ------------------------------------------------------------------

/**
 * Builds a draft payroll run for a company/month, computing each employee's
 * net pay from their salaryStructure minus a per-day rate for every
 * 'absent' attendance day that month (leave days are NOT deducted — they
 * were already approved). Days with no attendance record at all are treated
 * as present (assume marked-by-exception), matching how most small
 * businesses actually run attendance.
 */
async function generatePayroll({ companyId, month, year, userId }) {
  const existing = await PayrollRun.findOne({ companyId, month, year });
  if (existing) throw new Error(`Payroll for ${month}/${year} already exists (status: ${existing.status}).`);

  const employees = await Employee.find({ companyId, status: 'active' });
  const daysInMonth = new Date(year, month, 0).getDate();

  const entries = [];
  let totalNetPay = 0;

  for (const emp of employees) {
    const attendance = await attendanceForMonth(emp._id, month, year);
    const absentDays = attendance.filter((a) => a.status === 'absent').length;

    const basic = emp.salaryStructure?.basic || 0;
    const allowances = emp.salaryStructure?.allowances || 0;
    const fixedDeductions = emp.salaryStructure?.deductions || 0;
    const perDayRate = basic / daysInMonth;
    const attendanceDeduction = Math.round(perDayRate * absentDays * 100) / 100;

    const netPay = Math.round((basic + allowances - fixedDeductions - attendanceDeduction) * 100) / 100;
    totalNetPay += netPay;

    entries.push({
      employeeId: emp._id, basic, allowances, fixedDeductions,
      absentDays, attendanceDeduction, advances: 0, bonuses: 0, netPay,
    });
  }

  return PayrollRun.create({
    companyId, month, year, entries,
    totalNetPay: Math.round(totalNetPay * 100) / 100,
    status: 'draft', userId,
  });
}

/**
 * Adds (or replaces) extra pay on one employee's line in a still-draft
 * payroll run and recomputes both that entry's netPay and the run's total —
 * the generic hook any industry module uses to fold in its own bonus/
 * commission scheme without hrService needing to know that scheme exists.
 * Deliberately additive per call (adding again on top of a prior amount)
 * rather than a single field a second call would overwrite, since a
 * module might apply bonuses from more than one source across a period.
 */
async function addBonusToDraftPayroll(payrollRunId, employeeId, amount, note) {
  const run = await PayrollRun.findById(payrollRunId);
  if (!run) throw new Error('Payroll run not found.');
  if (run.status !== 'draft') throw new Error(`Cannot add pay to a payroll run with status "${run.status}" — only a draft can still be adjusted.`);

  const entry = run.entries.find((e) => String(e.employeeId) === String(employeeId));
  if (!entry) throw new Error('This employee is not on this payroll run (are they active and were they when it was generated?).');

  entry.bonuses = Math.round(((entry.bonuses || 0) + amount) * 100) / 100;
  entry.bonusNote = note ? [entry.bonusNote, note].filter(Boolean).join('; ') : entry.bonusNote;
  entry.netPay = Math.round((entry.basic + entry.allowances + entry.bonuses - entry.fixedDeductions - entry.attendanceDeduction) * 100) / 100;

  run.totalNetPay = Math.round(run.entries.reduce((sum, e) => sum + e.netPay, 0) * 100) / 100;
  await run.save();
  return run;
}

/** Posts the payroll run: Dr Salaries Expense, Cr the chosen payment account, one voucher for the whole run. */
async function postPayroll(payrollRunId, { paymentAccountId, userId }) {
  const session = await mongoose.startSession();
  try {
    let run;
    await session.withTransaction(async () => {
      run = await PayrollRun.findById(payrollRunId).session(session);
      if (!run) throw new Error('Payroll run not found.');
      if (run.status !== 'draft') throw new Error(`Already ${run.status}.`);
      if (run.totalNetPay <= 0) throw new Error('Payroll run has no net pay to post.');

      const salariesExpense = await defaultAccountsService.resolve(run.companyId, 'salariesExpenseId', session);

      if (!salariesExpense) {
        throw new Error('No Salaries Expense account configured for this company — set one in Settings, or create an account named like "Salaries" before posting payroll.');
      }

      const voucher = await accountingService.postVoucher({
        companyId: run.companyId, type: 'payment', date: new Date(),
        narration: `Payroll for ${run.month}/${run.year}`,
        entries: [
          { accountId: salariesExpense, debit: run.totalNetPay, credit: 0 },
          { accountId: paymentAccountId, debit: 0, credit: run.totalNetPay },
        ],
        referenceType: 'PayrollRun', referenceId: run._id, userId,
      }, session);

      run.status = 'posted';
      run.paymentAccountId = paymentAccountId;
      run.voucherId = voucher._id;
      run.postedAt = new Date();
      await run.save({ session });

      await auditService.record({
        companyId: run.companyId, userId, action: 'payroll_run.posted',
        entityType: 'PayrollRun', entityId: run._id, metadata: { month: run.month, year: run.year, totalNetPay: run.totalNetPay },
      }, session);
    });
    return run;
  } finally {
    session.endSession();
  }
}

module.exports = {
  createEmployee, terminateEmployee,
  markAttendance, attendanceForMonth,
  requestLeave, decideLeave,
  generatePayroll, addBonusToDraftPayroll, postPayroll,
};
