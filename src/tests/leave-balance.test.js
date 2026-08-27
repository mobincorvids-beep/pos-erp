/**
 * Integration tests for hrService's leave-balance deduction logic:
 * createLeavePolicy -> requestLeave -> decideLeave({approve: true}).
 *
 * decideLeave(), on approval, marks every day in [fromDate, toDate]
 * (inclusive of both ends) as 'leave' attendance, and — when the request
 * references a leavePolicyId — deducts leaveDaySpan(leave) days from that
 * employee/policy/year's LeaveBalance (creating the balance record with the
 * policy's default entitlement on first use). remainingDays is a virtual:
 * entitledDays - usedDays.
 *
 * Requires a real MongoDB replica set at process.env.MONGO_URI. Creates
 * its own throwaway company.
 */
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const connectDB = require('../config/db');

const companyProvisioningService = require('../services/companyProvisioningService');
const hrService = require('../services/hrService');
const LeaveBalance = require('../models/LeaveBalance');
const Attendance = require('../models/Attendance');

let company, branch;
let suffix;

beforeAll(async () => {
  await connectDB();
  suffix = nanoid(6).toLowerCase();
  const result = await companyProvisioningService.onboardCompany({
    name: `Leave Test Co ${suffix}`,
    industryType: 'retail',
    adminName: 'Leave Test Admin',
    adminEmail: `leave-test-${suffix}@test.local`,
  });
  ({ company, branch } = result);
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('hrService leave policy + decideLeave', () => {
  test('approving a leave request deducts the correct number of days from the balance', async () => {
    const policy = await hrService.createLeavePolicy({
      companyId: company._id, name: `Annual Leave ${suffix}`, annualEntitlementDays: 14,
      carryForwardAllowed: false, maxCarryForwardDays: 0, active: true,
    });

    const employee = await hrService.createEmployee({
      companyId: company._id, branchId: branch._id, name: `Leave Test Employee ${suffix}`,
      designation: 'Cashier', joiningDate: new Date('2024-01-01'),
      salaryStructure: { basic: 20000, allowances: 0, deductions: 0 },
    });

    // 5 calendar days inclusive: Jan 10 -> Jan 14, 2026.
    const fromDate = new Date('2026-01-10');
    const toDate = new Date('2026-01-14');

    const leaveRequest = await hrService.requestLeave({
      companyId: company._id, employeeId: employee._id, fromDate, toDate,
      type: 'annual', reason: 'Vacation', leavePolicyId: policy._id,
    });
    expect(leaveRequest.status).toBe('pending');

    const decided = await hrService.decideLeave(leaveRequest._id, { approve: true });
    expect(decided.status).toBe('approved');

    // Balance record is auto-created on first approval using the policy's
    // default entitlement (14), then usedDays incremented by the 5-day span.
    const balance = await LeaveBalance.findOne({ employeeId: employee._id, leavePolicyId: policy._id, year: 2026 });
    expect(balance).toBeTruthy();
    expect(balance.entitledDays).toBe(14);
    expect(balance.usedDays).toBe(5);
    expect(balance.remainingDays).toBe(9); // 14 - 5

    // Every day in the span was marked as 'leave' attendance (5 days: 10,11,12,13,14).
    const attendanceDays = await Attendance.find({
      employeeId: employee._id, date: { $gte: new Date('2026-01-10'), $lte: new Date('2026-01-14T23:59:59') },
    });
    expect(attendanceDays.length).toBe(5);
    for (const day of attendanceDays) {
      expect(day.status).toBe('leave');
    }

    // A second, non-overlapping 2-day leave request against the same
    // policy/year should ADD to the existing balance, not reset it.
    const secondRequest = await hrService.requestLeave({
      companyId: company._id, employeeId: employee._id,
      fromDate: new Date('2026-01-20'), toDate: new Date('2026-01-21'),
      type: 'annual', reason: 'Extra day', leavePolicyId: policy._id,
    });
    await hrService.decideLeave(secondRequest._id, { approve: true });

    const balanceAfterSecond = await LeaveBalance.findOne({ employeeId: employee._id, leavePolicyId: policy._id, year: 2026 });
    expect(balanceAfterSecond.usedDays).toBe(7); // 5 + 2
    expect(balanceAfterSecond.remainingDays).toBe(7); // 14 - 7

    // Rejecting a leave request must NOT touch the balance or mark attendance.
    const thirdRequest = await hrService.requestLeave({
      companyId: company._id, employeeId: employee._id,
      fromDate: new Date('2026-02-01'), toDate: new Date('2026-02-01'),
      type: 'annual', reason: 'Will be rejected', leavePolicyId: policy._id,
    });
    const rejected = await hrService.decideLeave(thirdRequest._id, { approve: false });
    expect(rejected.status).toBe('rejected');

    const balanceAfterRejection = await LeaveBalance.findOne({ employeeId: employee._id, leavePolicyId: policy._id, year: 2026 });
    expect(balanceAfterRejection.usedDays).toBe(7); // unchanged

    // Deciding an already-decided request again must be rejected.
    await expect(
      hrService.decideLeave(leaveRequest._id, { approve: true })
    ).rejects.toThrow(/Already approved/i);
  });
});
