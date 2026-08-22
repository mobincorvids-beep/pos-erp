const { Schema, model } = require('mongoose');

const versionSchema = new Schema({
  versionNumber: { type: Number, required: true },
  fileUrl: { type: String, required: true },
  fileName: { type: String, required: true },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedAt: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

// A document attached to ANY entity in this app (a PurchaseOrder, an
// Employee's ID copy, a FixedAsset's purchase invoice, a lease
// agreement...) — genuinely versioned, not overwritten: uploading a new
// version APPENDS to `versions`, so the full history stays visible and
// nothing is ever silently lost, the same append-only principle Courier's
// shipment status history already established. `approvalRequestId` and
// expiry tracking deliberately REUSE the existing Workflow and
// Notification engines rather than reimplementing approval or alerting
// logic a third time in this app.
const documentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  entityType: { type: String, required: true }, // 'PurchaseOrder', 'Employee', 'FixedAsset', ...
  entityId: { type: Schema.Types.ObjectId, required: true },
  category: { type: String, required: true }, // 'Contract', 'ID Copy', 'Invoice', 'License'...
  versions: { type: [versionSchema], required: true },
  expiryDate: { type: Date, default: null }, // for documents that genuinely expire (a license, an ID, a contract) — null means "doesn't expire"
  expiryNotified: { type: Boolean, default: false }, // prevents re-notifying every single day once an expiry alert has already fired once
  approvalRequestId: { type: Schema.Types.ObjectId, ref: 'ApprovalRequest', default: null },
  tags: [String],
}, { timestamps: true });

documentSchema.index({ companyId: 1, entityType: 1, entityId: 1 });
documentSchema.index({ companyId: 1, expiryDate: 1 });

module.exports = model('Document', documentSchema);
