const { Schema, model } = require('mongoose');

// Inline base64 attachment, same "no separate file-storage infra" pattern
// Document.js and ChatMessage.js already established — a photo of the
// damage/police report lives right on the incident, capped like every
// other inline upload in this app.
const INCIDENT_ATTACHMENT_MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, pre-base64

const attachmentSchema = new Schema({
  fileName: { type: String, required: true },
  fileData: { type: String, required: true }, // inline base64 data-URI, e.g. "data:image/jpeg;base64,...."
  mimeType: { type: String, default: null },
  fileSizeBytes: { type: Number, default: null },
  uploadedAt: { type: Date, default: Date.now },
}, { _id: false });

// One accident/damage/theft/other event against a company vehicle —
// distinct from MaintenanceWorkOrder (planned/preventive work on a
// FixedAsset) and from FuelLog/VehicleTrip (routine running costs): this
// is the unplanned, potentially-insurance-claimable kind of event.
const vehicleIncidentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  vehicleId: { type: Schema.Types.ObjectId, ref: 'CompanyVehicle', required: true },
  driverId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  // The real driver PROFILE (license/document tracking — see
  // src/models/Driver.js), additive alongside driverId above (kept as-is,
  // ref 'User'). Optional/nullable, same rationale as CompanyVehicle.driverProfileId.
  driverProfileId: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
  date: { type: Date, default: Date.now },
  type: { type: String, required: true, enum: ['accident', 'damage', 'theft', 'other'] },
  description: { type: String, default: '' },
  estimatedCost: { type: Number, default: 0 },
  claimStatus: { type: String, default: 'none', enum: ['none', 'filed', 'approved', 'rejected', 'paid'] },
  attachments: { type: [attachmentSchema], default: [] },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

vehicleIncidentSchema.index({ companyId: 1, vehicleId: 1, date: -1 });
vehicleIncidentSchema.index({ companyId: 1, claimStatus: 1 });

module.exports = model('VehicleIncident', vehicleIncidentSchema);
module.exports.INCIDENT_ATTACHMENT_MAX_FILE_BYTES = INCIDENT_ATTACHMENT_MAX_FILE_BYTES;
