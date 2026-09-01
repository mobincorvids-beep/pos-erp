const { Schema, model } = require('mongoose');

// A leave type/policy a company defines (e.g. "Annual Leave", "Sick Leave")
// with a yearly entitlement. LeaveBalance tracks the actual per-employee
// per-year usage against this policy's entitledDays.
const leavePolicySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  annualEntitlementDays: { type: Number, required: true, default: 0 },
  carryForwardAllowed: { type: Boolean, default: false },
  maxCarryForwardDays: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('LeavePolicy', leavePolicySchema);
