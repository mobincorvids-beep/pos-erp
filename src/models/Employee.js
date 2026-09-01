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
}, { timestamps: true });

module.exports = model('Employee', employeeSchema);
