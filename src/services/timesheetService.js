/**
 * TimesheetService — plain draft -> submitted -> approved/rejected
 * lifecycle for one employee's logged hours against a project/task. No
 * accounting postings here (unlike EmployeeLoan) — this is a record used
 * downstream by Payroll/Projects/Professional Services reporting, not a
 * financial transaction in its own right.
 */
const Timesheet = require('../models/Timesheet');
const Employee = require('../models/Employee');
const ProjectCost = require('../models/ProjectCost');

async function logTime(input) {
  const { companyId, employeeId, projectId, taskId, date, hours, description, billable } = input;
  if (!employeeId) throw new Error('employeeId is required.');
  if (!date) throw new Error('date is required.');
  if (!hours || hours <= 0) throw new Error('hours must be greater than zero.');

  return Timesheet.create({
    companyId, employeeId, projectId: projectId || null, taskId: taskId || null,
    date, hours, description: description || '', billable: !!billable,
  });
}

function listTimesheets(companyId, { employeeId, projectId, status, from, to } = {}) {
  const filter = { companyId };
  if (employeeId) filter.employeeId = employeeId;
  if (projectId) filter.projectId = projectId;
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  return Timesheet.find(filter)
    .populate('employeeId', 'name')
    .populate('projectId', 'name code')
    .sort({ date: -1, createdAt: -1 });
}

async function getTimesheet(companyId, id) {
  const entry = await Timesheet.findOne({ _id: id, companyId });
  if (!entry) throw new Error('Timesheet entry not found.');
  return entry;
}

async function updateTimesheet(companyId, id, updates) {
  const entry = await getTimesheet(companyId, id);
  if (entry.status !== 'draft') throw new Error('Only draft entries can be edited.');
  const { projectId, taskId, date, hours, description, billable } = updates;
  if (hours !== undefined) {
    if (!hours || hours <= 0) throw new Error('hours must be greater than zero.');
    entry.hours = hours;
  }
  if (projectId !== undefined) entry.projectId = projectId || null;
  if (taskId !== undefined) entry.taskId = taskId || null;
  if (date !== undefined) entry.date = date;
  if (description !== undefined) entry.description = description;
  if (billable !== undefined) entry.billable = !!billable;
  await entry.save();
  return entry;
}

async function submitTimesheet(companyId, id) {
  const entry = await getTimesheet(companyId, id);
  if (entry.status !== 'draft') throw new Error('Only draft entries can be submitted.');
  entry.status = 'submitted';
  await entry.save();
  return entry;
}

/**
 * Approving a timesheet is also where project labor cost gets posted: if
 * the entry is tagged with a projectId, this auto-creates a ProjectCost
 * ('labor') record for hours x the employee's hourlyRate, reusing
 * ProjectCost's existing shape (the same model expenseService/
 * purchaseService write into) rather than building a separate labor-cost
 * mechanism. An employee with no hourlyRate set (0) still gets approved
 * normally — it just posts a $0 cost entry, since there's no rate to guess from.
 */
async function approveTimesheet(companyId, id, approvedByUserId) {
  const entry = await getTimesheet(companyId, id);
  if (entry.status !== 'submitted') throw new Error('Only submitted entries can be approved.');
  entry.status = 'approved';
  entry.approvedBy = approvedByUserId;
  entry.rejectionReason = '';
  await entry.save();

  if (entry.projectId) {
    const employee = await Employee.findById(entry.employeeId);
    const rate = employee?.hourlyRate || 0;
    const cost = Math.round(entry.hours * rate * 100) / 100;
    await ProjectCost.create({
      companyId, projectId: entry.projectId, type: 'labor', amount: cost,
      referenceType: 'Timesheet', referenceId: entry._id,
      date: entry.date,
      note: `Labor cost: ${entry.hours}h${entry.taskId ? ` (task ${entry.taskId})` : ''} @ ${rate}/hr — ${employee?.name || 'employee'}`,
      userId: approvedByUserId,
    });
  }

  return entry;
}

async function rejectTimesheet(companyId, id, approvedByUserId, reason) {
  const entry = await getTimesheet(companyId, id);
  if (entry.status !== 'submitted') throw new Error('Only submitted entries can be rejected.');
  entry.status = 'rejected';
  entry.approvedBy = approvedByUserId;
  entry.rejectionReason = reason || '';
  await entry.save();
  return entry;
}

async function deleteTimesheet(companyId, id) {
  const entry = await getTimesheet(companyId, id);
  if (entry.status === 'approved') throw new Error('Approved entries cannot be deleted.');
  await entry.deleteOne();
  return { deleted: true };
}

module.exports = {
  logTime, listTimesheets, getTimesheet, updateTimesheet,
  submitTimesheet, approveTimesheet, rejectTimesheet, deleteTimesheet,
};
