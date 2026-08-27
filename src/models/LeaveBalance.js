const { Schema, model } = require('mongoose');

// One document per employee per leave policy per year — the actual ledger
// approving a LeaveRequest deducts against. remainingDays is derived
// (entitledDays - usedDays), not stored, so it can never drift out of sync.
const leaveBalanceSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  leavePolicyId: { type: Schema.Types.ObjectId, ref: 'LeavePolicy', required: true, index: true },
  year: { type: Number, required: true },
  entitledDays: { type: Number, required: true, default: 0 },
  usedDays: { type: Number, default: 0 },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

leaveBalanceSchema.index({ employeeId: 1, leavePolicyId: 1, year: 1 }, { unique: true });

leaveBalanceSchema.virtual('remainingDays').get(function remainingDays() {
  return Math.round(((this.entitledDays || 0) - (this.usedDays || 0)) * 100) / 100;
});

module.exports = model('LeaveBalance', leaveBalanceSchema);
