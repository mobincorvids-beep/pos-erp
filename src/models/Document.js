const { Schema, model } = require('mongoose');

// This app has no cloud storage (no multer-to-disk/S3/presigned-URL infra
// wired up for Documents — see productController's `validateImages` for
// the one precedent this follows). Files are stored INLINE as a base64
// data-URI on `fileData`, the exact same approach product images already
// use, just generalized to any mime type instead of images only.
// `fileUrl` is kept for backward compatibility with anything that already
// points at a real, externally-hosted URL (e.g. a presigned S3 link in a
// future deployment) — a version has EITHER fileUrl OR fileData, not
// necessarily both. 10MB is a hard cap: unlike images, a document can't be
// client-side resized/recompressed to fit, so oversized files are simply
// rejected with a clear error rather than silently truncated.
const DOCUMENT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, pre-base64

const versionSchema = new Schema({
  versionNumber: { type: Number, required: true },
  fileUrl: { type: String, default: null }, // an already-hosted file's URL (legacy/external path)
  fileData: { type: String, default: null }, // inline base64 data-URI, e.g. "data:application/pdf;base64,...."
  fileName: { type: String, required: true },
  mimeType: { type: String, default: null },
  fileSizeBytes: { type: Number, default: null },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  uploadedAt: { type: Date, default: Date.now },
  note: String,
}, { _id: false });

versionSchema.pre('validate', function requireFileUrlOrFileData(next) {
  if (!this.fileUrl && !this.fileData) return next(new Error('Each document version needs either fileUrl or fileData.'));
  next();
});

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
module.exports.DOCUMENT_MAX_FILE_BYTES = DOCUMENT_MAX_FILE_BYTES;
