const { Schema, model } = require('mongoose');

const payrollEntrySchema = new Schema({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  basic: { type: Number, required: true },
  allowances: { type: Number, default: 0 },
  fixedDeductions: { type: Number, default: 0 },
  absentDays: { type: Number, default: 0 },
  attendanceDeduction: { type: Number, default: 0 }, // per-absent-day deduction computed from attendance
  advances: { type: Number, default: 0 },
  // Generic extra pay — core has no opinion on WHERE this comes from
  // (a manual bonus, an industry module's commission scheme, anything
  // else). See hrService.addBonusToDraftPayroll(); an industry module
  // (e.g. Salon) calls that hook rather than this schema knowing about
  // StaffCommission or any other module-specific concept.
  bonuses: { type: Number, default: 0 },
  bonusNote: String,
  netPay: { type: Number, required: true },
}, { _id: false });

// One payroll run per company per month. Kept as a batch document (not one
// row per employee across many collections) so "process payroll for
// August" is a single approve/post action with a single ledger voucher,
// matching how Expense/PurchaseOrder approvals post one voucher each.
const payrollRunSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  month: { type: Number, required: true }, // 1-12
  year: { type: Number, required: true },
  entries: [payrollEntrySchema],
  totalNetPay: { type: Number, default: 0 },
  status: { type: String, default: 'draft', enum: ['draft', 'posted'] },
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account' }, // set when posted
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  postedAt: Date,
}, { timestamps: true });

payrollRunSchema.index({ companyId: 1, month: 1, year: 1 }, { unique: true });

module.exports = model('PayrollRun', payrollRunSchema);
