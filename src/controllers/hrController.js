const Employee = require('../models/Employee');
const LeaveRequest = require('../models/LeaveRequest');
const PayrollRun = require('../models/PayrollRun');
const hrService = require('../services/hrService');

async function listEmployees(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await Employee.find(filter).populate('departmentId', 'name');
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
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await LeaveRequest.find(filter).populate('employeeId', 'name').sort({ createdAt: -1 });
  res.json(rows);
}

async function decideLeave(req, res) {
  try {
    const leave = await hrService.decideLeave(req.params.id, { approve: req.body.approve, userId: req.auth.userId });
    res.json(leave);
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

module.exports = {
  listEmployees, createEmployee, terminateEmployee,
  markAttendance, attendanceForMonth,
  requestLeave, listLeaveRequests, decideLeave,
  generatePayroll, listPayrollRuns, getPayrollRun, postPayroll,
};
