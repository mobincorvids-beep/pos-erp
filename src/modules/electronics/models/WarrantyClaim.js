const { Schema, model } = require('mongoose');

// A claim against a Warranty. The actual repair work is a real core
// ServiceOrder job card (parts, labor, technician assignment — all
// unchanged, reused as-is) once a claim is approved; this model only
// tracks the claim's own decision (approved/rejected) and links to that
// job card, mirroring the "tag a core document, don't reimplement it"
// interlink pattern Service Station and Hospital both already established.
const warrantyClaimSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  warrantyId: { type: Schema.Types.ObjectId, ref: 'Warranty', required: true, index: true },
  issueDescription: { type: String, required: true },
  status: { type: String, default: 'submitted', enum: ['submitted', 'approved', 'rejected', 'in_repair', 'resolved'] },
  decisionNote: String,
  serviceOrderId: { type: Schema.Types.ObjectId, ref: 'ServiceOrder', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('WarrantyClaim', warrantyClaimSchema);
