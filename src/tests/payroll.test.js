/**
 * Integration tests for hrService.generatePayroll / postPayroll.
 *
 * generatePayroll() computes, per active employee:
 *   perDayRate = salaryStructure.basic / daysInMonth
 *   attendanceDeduction = round(perDayRate * absentDays, 2)
 *   netPay = round(basic + allowances - fixedDeductions - attendanceDeduction - advances, 2)
 * (advances comes from employeeLoanService.monthlyDeductionFor(), which is
 * 0 for an employee with no active loan — true for every employee here).
 *
 * postPayroll() then posts one voucher: Dr Salaries Expense, Cr the chosen
 * payment account, for totalNetPay.
 *
 * Requires a real MongoDB replica set at process.env.MONGO_URI. Creates
 * its own throwaway company.
 */
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const connectDB = require('../config/db');

const Account = require('../models/Account');
const Employee = require('../models/Employee');
const Voucher = require('../models/Voucher');
const companyProvisioningService = require('../services/companyProvisioningService');
const hrService = require('../services/hrService');

let company, branch;
let cash;
let suffix;

beforeAll(async () => {
  await connectDB();
  suffix = nanoid(6).toLowerCase();
  const result = await companyProvisioningService.onboardCompany({
    name: `Payroll Test Co ${suffix}`,
    industryType: 'retail',
    adminName: 'Payroll Test Admin',
    adminEmail: `payroll-test-${suffix}@test.local`,
  });
  ({ company, branch } = result);

  const accounts = await Account.find({ companyId: company._id });
  cash = accounts.find((a) => /^Cash$/.test(a.name));
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('hrService.generatePayroll + postPayroll', () => {
  test('computes correct net pay from salaryStructure and attendance, then posts a balanced voucher', async () => {
    // Pick a month/year in the past so it's a closed, deterministic month
    // (28 days -> daysInMonth is fixed and known: February of a non-leap year).
    const year = 2025;
    const month = 2; // Feb 2025 has 28 days
    const daysInMonth = 28;

    const employee = await hrService.createEmployee({
      companyId: company._id, branchId: branch._id, name: `Payroll Test Employee ${suffix}`,
      designation: 'Cashier', joiningDate: new Date('2024-01-01'),
      salaryStructure: { basic: 28000, allowances: 2000, deductions: 500 },
    });

    // Mark 2 absent days within the payroll month.
    await hrService.markAttendance({ companyId: company._id, employeeId: employee._id, date: new Date(2025, 1, 5), status: 'absent' });
    await hrService.markAttendance({ companyId: company._id, employeeId: employee._id, date: new Date(2025, 1, 12), status: 'absent' });
    // A present day should NOT count toward the deduction.
    await hrService.markAttendance({ companyId: company._id, employeeId: employee._id, date: new Date(2025, 1, 6), status: 'present' });

    const run = await hrService.generatePayroll({ companyId: company._id, month, year });

    const perDayRate = 28000 / daysInMonth; // 1000
    const expectedAttendanceDeduction = Math.round(perDayRate * 2 * 100) / 100; // 2000
    const expectedNetPay = Math.round((28000 + 2000 - 500 - expectedAttendanceDeduction - 0) * 100) / 100; // 27500

    const entry = run.entries.find((e) => String(e.employeeId) === String(employee._id));
    expect(entry).toBeTruthy();
    expect(entry.absentDays).toBe(2);
    expect(entry.attendanceDeduction).toBe(expectedAttendanceDeduction);
    expect(entry.attendanceDeduction).toBe(2000);
    expect(entry.advances).toBe(0);
    expect(entry.netPay).toBe(expectedNetPay);
    expect(entry.netPay).toBe(27500);

    expect(run.totalNetPay).toBe(27500);
    expect(run.status).toBe('draft');

    // Generating twice for the same company/month/year must be rejected.
    await expect(
      hrService.generatePayroll({ companyId: company._id, month, year })
    ).rejects.toThrow(/already exists/i);

    // Post the payroll: Dr Salaries Expense 27500, Cr Cash 27500.
    const posted = await hrService.postPayroll(run._id, { paymentAccountId: cash._id });
    expect(posted.status).toBe('posted');
    expect(posted.voucherId).toBeTruthy();

    const voucher = await Voucher.findById(posted.voucherId);
    expect(voucher).toBeTruthy();

    const totalDebit = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    expect(totalDebit).toBe(27500);
    expect(totalCredit).toBe(27500);
    expect(totalDebit).toBe(totalCredit);

    const cashEntry = voucher.entries.find((e) => String(e.accountId) === String(cash._id));
    expect(cashEntry.credit).toBe(27500);

    // Posting an already-posted run again must be rejected.
    await expect(
      hrService.postPayroll(run._id, { paymentAccountId: cash._id })
    ).rejects.toThrow(/Already posted/i);
  });
});
