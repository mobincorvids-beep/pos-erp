const { Schema, model } = require('mongoose');

// Deliberately separate from User — User is a login account (email +
// password, scoped by Role/permissions); Employee is the HR record (salary,
// department, joining date) and may or may not have a login at all (e.g. a
// kitchen helper who never touches the POS). userId links the two when
// an employee IS also a system user, without forcing every employee to be one.
const employeeSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department' },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', default: null },
  // Self-referencing reporting line, same pattern as Category.parentId —
  // null means "top of the org chart" (an owner/CEO with no manager).
  // Optional and defaults to null, so every existing Employee document is
  // unaffected until someone actually sets it.
  managerId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },

  name: { type: String, required: true },
  designation: String, // Cashier, Waiter, Accountant...
  phone: String,
  joiningDate: { type: Date, default: Date.now },
  status: { type: String, default: 'active', enum: ['active', 'on_leave', 'terminated'] },
  terminatedAt: Date,

  salaryStructure: {
    basic: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 }, // fixed monthly allowances, summed
    deductions: { type: Number, default: 0 }, // fixed monthly deductions (before attendance-based ones)
  },

  // Labor-costing rate: cost per hour of this employee's time, used by
  // timesheetService.approveTimesheet to auto-post a ProjectCost('labor')
  // entry (hours x hourlyRate) whenever an approved timesheet is tagged
  // with a project. Optional and defaults to 0 — an employee with no rate
  // set simply doesn't generate labor cost entries (rather than guessing).
  hourlyRate: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = model('Employee', employeeSchema);
