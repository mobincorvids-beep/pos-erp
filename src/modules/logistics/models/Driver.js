const { Schema, model } = require('mongoose');

// Inline base64 attachment — same "no separate file-storage infra" pattern
// VehicleIncident.js established for a photo of damage/police reports,
// reused here for a scan of a license/document.
const DRIVER_DOC_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, pre-base64
const attachmentSchema = new Schema({
  fileName: { type: String, required: true },
  fileData: { type: String, required: true }, // inline base64 data-URI
  mimeType: { type: String, default: null },
  fileSizeBytes: { type: Number, default: null },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// One other tracked document (medical certificate, PSV badge, hazmat
// endorsement, etc.) beyond the driver's primary license — kept as a
// simple array on Driver itself rather than routed through the generic
// Document collection, since these are always small, driver-scoped
// records that fleetService/vehicleIncidentService and
// getExpiringDriverDocuments() all want to read in one query without a
// second collection join.
const driverDocumentSchema = new Schema({
  label: { type: String, required: true }, // "Medical certificate", "PSV badge"...
  documentNumber: { type: String, default: '' },
  expiryDate: { type: Date, default: null },
  attachment: { type: attachmentSchema, default: null },
  expiryNotified: { type: Boolean, default: false }, // mirrors Document.expiryNotified so getExpiringDriverDocuments doesn't re-alert daily
}, { _id: true });

// A fleet driver. This was originally a bare {companyId, name,
// licenseNumber, phone} record (still fully compatible with every
// existing field above); extended with license/document expiry tracking
// and an optional link to a real login account. userId stays optional —
// a purely-tracked employee/contractor driver with no login is valid.
const driverSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // optional link to a real login account
  name: { type: String, required: true },
  phone: { type: String, default: '' },

  licenseNumber: { type: String, default: '' },
  licenseExpiry: { type: Date, default: null },
  licenseExpiryNotified: { type: Boolean, default: false },

  otherDocuments: { type: [driverDocumentSchema], default: [] },

  status: { type: String, default: 'active', enum: ['active', 'suspended', 'inactive'] },
  notes: { type: String, default: '' },
}, { timestamps: true });

driverSchema.index({ companyId: 1, status: 1 });
driverSchema.index({ companyId: 1, licenseExpiry: 1 });

module.exports = model('Driver', driverSchema);
module.exports.DRIVER_DOC_ATTACHMENT_MAX_FILE_BYTES = DRIVER_DOC_ATTACHMENT_MAX_FILE_BYTES;
