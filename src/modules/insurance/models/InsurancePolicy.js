const { Schema, model } = require('mongoose');

// A policy — sold the same way Cafe sells a subscription (a real Sale
// through checkout, with a validity period), because that reuse is
// genuinely honest here: both are "pay once, get an entitlement for a
// fixed period" in shape. What's different is the entitlement itself —
// coverageAmount is the real new field this module needed, since a claim
// against it has to be checked against a real ceiling that Cafe's
// subscription (a redemption count, not a currency amount) never needed.
const insurancePolicySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  policyType: { type: String, required: true }, // "Motor", "Health", "Property"...
  coverageAmount: { type: Number, required: true }, // the real ceiling any claim against this policy is checked against
  premiumAmount: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, default: 'active', enum: ['active', 'expired', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // the premium payment itself
}, { timestamps: true });

module.exports = model('InsurancePolicy', insurancePolicySchema);
