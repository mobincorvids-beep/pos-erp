/**
 * EmployeePortalService — employee self-service: invite/activate, login,
 * and read-only access to their own attendance/payslips, plus the ability
 * to submit a leave request through the existing hrService flow (never a
 * duplicate approval mechanism — decideLeave() in hrService is still the
 * only thing that approves it). Mirrors portalService.js's shape closely.
 *
 * Deliberately does not expose anything financial beyond the employee's
 * own payroll entries, and never lets the employee approve their own
 * leave or edit salary/attendance — those stay staff-only via hrService.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const EmployeePortalUser = require('../models/EmployeePortalUser');
const Employee = require('../models/Employee');
const Attendance = require('../models/Attendance');
const LeaveRequest = require('../models/LeaveRequest');
const PayrollRun = require('../models/PayrollRun');
const refreshTokenService = require('./refreshTokenService');
const notificationService = require('./notificationService');
const hrService = require('./hrService');

// Same "single-use, time-limited invite" pattern as the customer portal —
// expires in 7 days.
function signInviteToken(employeePortalUserId) {
  return jwt.sign({ employeePortal: true, invite: true, employeePortalUserId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function signPortalAccessToken(portalUser) {
  return jwt.sign(
    { employeePortal: true, employeePortalUserId: portalUser._id, employeeId: portalUser.employeeId, companyId: portalUser.companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

/** Staff-initiated — creates (or reuses) a portal login for an employee and returns an activation invite token. No password is set yet; the employee chooses their own via activateInvite(). */
async function invite({ companyId, employeeId, email, userId }) {
  const employee = await Employee.findOne({ _id: employeeId, companyId });
  if (!employee) throw new Error('Employee not found.');

  let portalUser = await EmployeePortalUser.findOne({ employeeId });
  if (portalUser) {
    portalUser.email = email.toLowerCase().trim();
    portalUser.isActive = false; // stays inactive until they set a password via the invite link
    portalUser.invitedAt = new Date();
  } else {
    // A random, throwaway placeholder hash — never usable to log in
    // (activateInvite always overwrites it before the account is marked active).
    const placeholder = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    portalUser = new EmployeePortalUser({ companyId, employeeId, email: email.toLowerCase().trim(), passwordHash: placeholder, isActive: false });
  }
  await portalUser.save();

  const inviteToken = signInviteToken(portalUser._id);

  await notificationService.notify({
    companyId, userId, type: 'employee_portal_invite_sent', title: 'Employee portal invite sent',
    message: `Invited ${employee.name} to the employee portal`, entityType: 'Employee', entityId: employee._id,
  });

  // Delivery (email/SMS/copy-paste) is the controller's concern, not this service's.
  return { employeePortalUserId: portalUser._id, inviteToken };
}

/** Employee clicks their invite link and sets a real password for the first time. */
async function activateInvite(inviteToken, password) {
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  let payload;
  try {
    payload = jwt.verify(inviteToken, process.env.JWT_SECRET);
  } catch {
    throw new Error('This invite link is invalid or has expired.');
  }
  if (!payload.invite) throw new Error('Not a valid invite token.');

  const portalUser = await EmployeePortalUser.findById(payload.employeePortalUserId);
  if (!portalUser) throw new Error('Invite not found.');

  portalUser.passwordHash = await bcrypt.hash(password, 10);
  portalUser.isActive = true;
  portalUser.activatedAt = new Date();
  await portalUser.save();
  return portalUser;
}

async function login({ email, password, deviceContext }) {
  const portalUser = await EmployeePortalUser.findOne({ email: email.toLowerCase().trim() });
  if (!portalUser || !portalUser.isActive) throw new Error('Invalid email or password.');

  const valid = await bcrypt.compare(password, portalUser.passwordHash);
  if (!valid) throw new Error('Invalid email or password.');

  portalUser.lastLoginAt = new Date();
  await portalUser.save();

  const accessToken = signPortalAccessToken(portalUser);
  const refreshToken = await refreshTokenService.issue('EmployeePortalUser', portalUser._id, deviceContext);
  return { accessToken, refreshToken, employeeId: portalUser.employeeId };
}

/** Exchanges a refresh token for a new access token — same rotation-with-reuse-detection flow the staff/customer-portal sessions use. */
async function refresh(rawRefreshToken) {
  const { subjectType, subjectId, newToken } = await refreshTokenService.rotate(rawRefreshToken);
  if (subjectType !== 'EmployeePortalUser') throw new Error('Invalid refresh token.');
  const portalUser = await EmployeePortalUser.findById(subjectId);
  if (!portalUser || !portalUser.isActive) throw new Error('Invalid or inactive portal account.');
  return { accessToken: signPortalAccessToken(portalUser), refreshToken: newToken };
}

/** The portal home view — the employee's own basic profile summary. */
async function dashboard(employeeId) {
  const employee = await Employee.findById(employeeId).select('name designation status joiningDate salaryStructure.basic');
  if (!employee) throw new Error('Employee not found.');
  const now = new Date();
  const recentAttendance = await Attendance.find({ employeeId }).sort({ date: -1 }).limit(10);
  return {
    profile: { name: employee.name, designation: employee.designation, status: employee.status, joiningDate: employee.joiningDate },
    recentAttendance,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

/** Attendance history for one calendar month (defaults to current month). */
function myAttendance(employeeId, { month, year } = {}) {
  const now = new Date();
  const m = month ? Number(month) : now.getMonth() + 1;
  const y = year ? Number(year) : now.getFullYear();
  return hrService.attendanceForMonth(employeeId, m, y);
}

/**
 * The employee's own payslips — PayrollRun stores one document per
 * company per month with an embedded `entries` array (one entry per
 * employee), not a separate Payslip collection, so "my payslips" means
 * pulling this employee's entry out of each POSTED run they appear on.
 * Draft runs are never shown — they aren't finalized pay yet.
 */
async function myPayslips(employeeId) {
  const runs = await PayrollRun.find({ 'entries.employeeId': employeeId, status: 'posted' }).sort({ year: -1, month: -1 });
  return runs.map((run) => {
    const entry = run.entries.find((e) => String(e.employeeId) === String(employeeId));
    return {
      payrollRunId: run._id, month: run.month, year: run.year, postedAt: run.postedAt,
      basic: entry.basic, allowances: entry.allowances, fixedDeductions: entry.fixedDeductions,
      absentDays: entry.absentDays, attendanceDeduction: entry.attendanceDeduction,
      advances: entry.advances, bonuses: entry.bonuses, bonusNote: entry.bonusNote, netPay: entry.netPay,
    };
  });
}

/** All of this employee's leave requests (any status), newest first. */
function myLeaveRequests(employeeId) {
  return LeaveRequest.find({ employeeId }).sort({ createdAt: -1 });
}

/**
 * Submits a leave request through the exact same hrService.requestLeave()
 * staff use — lands in 'pending' status, same as always. Approval still
 * only ever happens through hrService.decideLeave() by a manager/staff
 * user; this never grants the employee any approval power over their own
 * request.
 */
function requestLeave(companyId, employeeId, { fromDate, toDate, type, reason }) {
  return hrService.requestLeave({ companyId, employeeId, fromDate, toDate, type, reason });
}

/** Read-only view of the employee's own profile (no HR fields the portal doesn't already surface elsewhere). */
async function getProfile(employeeId) {
  const employee = await Employee.findById(employeeId).select('name designation phone joiningDate status');
  if (!employee) throw new Error('Employee not found.');
  return employee;
}

/**
 * Lets the employee update only the contact-detail fields that are
 * genuinely theirs to keep current (phone) plus their own portal login
 * email — never salary, designation, department, or status, which stay
 * staff-only via hrService.
 */
async function updateProfile(employeePortalUserId, employeeId, { phone, email }) {
  if (phone !== undefined) {
    await Employee.findByIdAndUpdate(employeeId, { phone });
  }
  if (email) {
    const portalUser = await EmployeePortalUser.findById(employeePortalUserId);
    if (!portalUser) throw new Error('Portal account not found.');
    portalUser.email = email.toLowerCase().trim();
    await portalUser.save();
  }
  return getProfile(employeeId);
}

module.exports = {
  invite, activateInvite, login, refresh, dashboard,
  myAttendance, myPayslips, myLeaveRequests, requestLeave,
  getProfile, updateProfile,
};
