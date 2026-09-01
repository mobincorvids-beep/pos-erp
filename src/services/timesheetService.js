/**
 * TimesheetService — plain draft -> submitted -> approved/rejected
 * lifecycle for one employee's logged hours against a project/task. No
 * accounting postings here (unlike EmployeeLoan) — this is a record used
 * downstream by Payroll/Projects/Professional Services reporting, not a
 * financial transaction in its own right.
 */
const Timesheet = require('../models/Timesheet');

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

async function approveTimesheet(companyId, id, approvedByUserId) {
  const entry = await getTimesheet(companyId, id);
  if (entry.status !== 'submitted') throw new Error('Only submitted entries can be approved.');
  entry.status = 'approved';
  entry.approvedBy = approvedByUserId;
  entry.rejectionReason = '';
  await entry.save();
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
