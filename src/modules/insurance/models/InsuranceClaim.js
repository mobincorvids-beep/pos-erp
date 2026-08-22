const { Schema, model } = require('mongoose');

// The claim workflow itself is exactly Electronics' warranty-claim shape
// (submit while the policy is valid -> decide -> resolve) — no new
// mechanic needed there. What genuinely IS new: claimAmount is checked
// against the policy's coverageAmount at submission (a real ceiling
// Electronics' repair claims never needed, since a repair isn't a
// currency amount), and an APPROVED claim posts a real payout voucher at
// decision time — Electronics' claims link to a repair job instead of
// moving cash, but an insurance claim's whole point IS moving cash.
const insuranceClaimSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true }, // denormalized from the policy at submission time — same reasoning as PilgrimPayment's branchId, so a payout voucher always has real branch context without re-fetching the policy
  policyId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy', required: true, index: true },
  claimAmount: { type: Number, required: true },
  description: { type: String, required: true },
  status: { type: String, default: 'submitted', enum: ['submitted', 'approved', 'rejected', 'paid'] },
  decisionNote: String,
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
}, { timestamps: true });

module.exports = model('InsuranceClaim', insuranceClaimSchema);
