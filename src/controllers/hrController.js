const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const PayrollRun = require('../models/PayrollRun');
const Shift = require('../models/Shift');
const LeavePolicy = require('../models/LeavePolicy');
const hrService = require('../services/hrService');
const { hasPermission } = require('../middleware/auth');
const { HR_MANAGE } = require('../constants/permissions');

async function listEmployees(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await Employee.find(filter).populate('departmentId', 'name').populate('shiftId', 'name startTime endTime');
  res.json(rows);
}

async function createEmployee(req, res) {
  try {
    const employee = await hrService.createEmployee({ ...req.body, companyId: req.companyId });
    res.status(201).json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function terminateEmployee(req, res) {
  try {
    const employee = await hrService.terminateEmployee(req.params.id);
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function setManager(req, res) {
  try {
    const employee = await hrService.setManager(req.params.id, req.body.managerId);
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function orgChart(req, res) {
  try {
    const tree = await hrService.orgChart(req.companyId);
    res.json(tree);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function markAttendance(req, res) {
  try {
    const attendance = await hrService.markAttendance({ ...req.body, companyId: req.companyId });
    res.status(201).json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function attendanceForMonth(req, res) {
  try {
    const rows = await hrService.attendanceForMonth(req.params.employeeId, Number(req.query.month), Number(req.query.year));
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function requestLeave(req, res) {
  try {
    const leave = await hrService.requestLeave({ ...req.body, companyId: req.companyId });
    res.status(201).json(leave);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listLeaveRequests(req, res) {
  // ?pendingMyApproval=true — the "pending my approval" list for a
  // manager: pending leave requests from employees who directly report to
  // the caller's own linked Employee record (see hrService.managerId).
  if (req.query.pendingMyApproval === 'true') {
    return res.json(await hrService.pendingApprovalForManager(req.companyId, req.auth.userId));
  }
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await LeaveRequest.find(filter).populate('employeeId', 'name').sort({ createdAt: -1 });
  res.json(rows);
}

async function decideLeave(req, res) {
  try {
    // A leave request is decided by either someone with HR_MANAGE, or the
    // requester's own direct manager (via Employee.managerId) — so a
    // manager doesn't need full HR access just to approve their team's
    // leave, matching how OrangeHRM routes leave approval to the reporting line.
    if (!hasPermission(req, HR_MANAGE)) {
      const leave = await LeaveRequest.findById(req.params.id);
      if (!leave) return res.status(404).json({ error: 'Leave request not found.' });
      const isManager = await hrService.isManagerOfEmployee(req.companyId, req.auth.userId, leave.employeeId);
      if (!isManager) return res.status(403).json({ error: `Missing permission: ${HR_MANAGE} (or must be the requester's manager).` });
    }
    const leave = await hrService.decideLeave(req.params.id, { approve: req.body.approve, userId: req.auth.userId });
    res.json(leave);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listShifts(req, res) {
  const rows = await Shift.find({ companyId: req.companyId }).sort({ name: 1 });
  res.json(rows);
}

async function createShift(req, res) {
  try {
    const shift = await hrService.createShift({ ...req.body, companyId: req.companyId });
    res.status(201).json(shift);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function assignShift(req, res) {
  try {
    const employee = await hrService.assignShiftToEmployee(req.body.employeeId, req.body.shiftId);
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listLeavePolicies(req, res) {
  const rows = await LeavePolicy.find({ companyId: req.companyId }).sort({ name: 1 });
  res.json(rows);
}

async function createLeavePolicy(req, res) {
  try {
    const policy = await hrService.createLeavePolicy({ ...req.body, companyId: req.companyId });
    res.status(201).json(policy);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getLeaveBalances(req, res) {
  try {
    const rows = await hrService.getLeaveBalances(req.params.employeeId);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function generatePayroll(req, res) {
  try {
    const run = await hrService.generatePayroll({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(run);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPayrollRuns(req, res) {
  const rows = await PayrollRun.find({ companyId: req.companyId }).sort({ year: -1, month: -1 });
  res.json(rows);
}

async function getPayrollRun(req, res) {
  const run = await PayrollRun.findOne({ _id: req.params.id, companyId: req.companyId }).populate('entries.employeeId', 'name');
  if (!run) return res.status(404).json({ error: 'Payroll run not found.' });
  res.json(run);
}

async function postPayroll(req, res) {
  try {
    const run = await hrService.postPayroll(req.params.id, { paymentAccountId: req.body.paymentAccountId, userId: req.auth.userId });
    res.json(run);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Self-service ("My HR") ------------------------------------------------
// Every function below resolves the caller's OWN Employee record from
// req.auth.userId (via Employee.userId) rather than trusting any
// employeeId the client might send — an employee can only ever see their
// own data through these endpoints, never someone else's by guessing an id.

async function myEmployee(req, res) {
  try {
    const employee = await hrService.findEmployeeByUserId(req.companyId, req.auth.userId);
    if (!employee) return res.status(404).json({ error: 'No employee record is linked to your account yet — ask HR to link it.' });
    res.json(employee);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Shared by every other my* endpoint: 404s cleanly instead of leaking a null employeeId into a query. */
async function requireLinkedEmployee(req, res) {
  const employee = await hrService.findEmployeeByUserId(req.companyId, req.auth.userId);
  if (!employee) { res.status(404).json({ error: 'No employee record is linked to your account yet — ask HR to link it.' }); return null; }
  return employee;
}

async function myLeaveBalances(req, res) {
  try {
    const employee = await requireLinkedEmployee(req, res);
    if (!employee) return;
    res.json(await hrService.getLeaveBalances(employee._id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function myAttendance(req, res) {
  try {
    const employee = await requireLinkedEmployee(req, res);
    if (!employee) return;
    const now = new Date();
    const month = req.query.month ? Number(req.query.month) : now.getMonth() + 1;
    const year = req.query.year ? Number(req.query.year) : now.getFullYear();
    res.json(await hrService.attendanceForMonth(employee._id, month, year));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function myLeaveRequests(req, res) {
  try {
    const employee = await requireLinkedEmployee(req, res);
    if (!employee) return;
    res.json(await LeaveRequest.find({ employeeId: employee._id }).sort({ createdAt: -1 }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function myRequestLeave(req, res) {
  try {
    const employee = await requireLinkedEmployee(req, res);
    if (!employee) return;
    // employeeId is deliberately taken from the resolved link, never from
    // req.body, so a self-service request can never be filed against a
    // different employee's record.
    const leave = await hrService.requestLeave({ ...req.body, employeeId: employee._id, companyId: req.companyId });
    res.status(201).json(leave);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** My own payslips — this employee's entry on every POSTED payroll run, same shape employeePortalService.myPayslips already exposes on the separate employee-portal login. */
async function myPayslips(req, res) {
  try {
    const employee = await requireLinkedEmployee(req, res);
    if (!employee) return;
    const runs = await PayrollRun.find({ 'entries.employeeId': employee._id, status: 'posted' }).sort({ year: -1, month: -1 });
    const payslips = runs.map((run) => {
      const entry = run.entries.find((e) => String(e.employeeId) === String(employee._id));
      return {
        payrollRunId: run._id, month: run.month, year: run.year, postedAt: run.postedAt,
        basic: entry.basic, allowances: entry.allowances, fixedDeductions: entry.fixedDeductions,
        absentDays: entry.absentDays, attendanceDeduction: entry.attendanceDeduction,
        advances: entry.advances, bonuses: entry.bonuses, bonusNote: entry.bonusNote, netPay: entry.netPay,
      };
    });
    res.json(payslips);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Disciplinary / grievance records (HR_MANAGE only) ---------------------

async function listDisciplinaryCases(req, res) {
  try {
    res.json(await hrService.listDisciplinaryCases(req.companyId, req.params.employeeId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createDisciplinaryCase(req, res) {
  try {
    const record = await hrService.createDisciplinaryCase({ ...req.body, companyId: req.companyId, recordedByUserId: req.auth.userId });
    res.status(201).json(record);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function resolveDisciplinaryCase(req, res) {
  try {
    res.json(await hrService.resolveDisciplinaryCase(req.params.id, { resolutionNotes: req.body.resolutionNotes }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  listEmployees, createEmployee, terminateEmployee, setManager, orgChart,
  markAttendance, attendanceForMonth,
  listShifts, createShift, assignShift,
  listLeavePolicies, createLeavePolicy, getLeaveBalances,
  requestLeave, listLeaveRequests, decideLeave,
  generatePayroll, listPayrollRuns, getPayrollRun, postPayroll,
  myEmployee, myLeaveBalances, myAttendance, myLeaveRequests, myRequestLeave, myPayslips,
  listDisciplinaryCases, createDisciplinaryCase, resolveDisciplinaryCase,
};
