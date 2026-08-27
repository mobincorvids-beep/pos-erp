const { Schema, model } = require('mongoose');

// One employee's hours against a project/task on a given day — the
// generic, company-wide time-tracking entity this app never had.
// Deliberately separate from ProfessionalServicesPage's ad-hoc "time
// entries" (which is a narrow, client-billing-only concept scoped to
// that one page) — this is the reusable entity for attendance/
// productivity/payroll context across ANY employee and ANY project/task,
// following the same companyId+index, ref+enum, draft-then-approve
// pattern as EmployeeLoan and the rest of this app's modules.
const timesheetSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
  // Not a strict `ref` requirement — Task may or may not exist yet in a
  // given deployment (built by a parallel effort), so this stays a plain
  // ObjectId that still populates fine once Task exists, without ever
  // failing validation on its own.
  taskId: { type: Schema.Types.ObjectId, default: null },
  date: { type: Date, required: true },
  hours: { type: Number, required: true, min: 0.01 },
  description: { type: String, default: '' },
  billable: { type: Boolean, default: false },
  status: { type: String, default: 'draft', enum: ['draft', 'submitted', 'approved', 'rejected'] },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

timesheetSchema.index({ companyId: 1, employeeId: 1, date: -1 });

module.exports = model('Timesheet', timesheetSchema);
