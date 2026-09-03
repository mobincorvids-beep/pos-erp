const { Schema, model } = require('mongoose');

// A lightweight disciplinary/grievance record against an employee —
// warnings, grievances filed, or incidents logged. Deliberately simple
// (no multi-step workflow engine wired in): HR records it, HR resolves
// it. Visible only to HR managers (HR_MANAGE), never surfaced on the
// employee's own self-service view.
const disciplinaryCaseSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  type: { type: String, required: true, enum: ['warning', 'grievance', 'incident'] },
  description: { type: String, required: true },
  dateRecorded: { type: Date, default: Date.now },
  status: { type: String, default: 'open', enum: ['open', 'resolved'] },
  recordedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  resolutionNotes: String,
  resolvedAt: Date,
}, { timestamps: true });

module.exports = model('DisciplinaryCase', disciplinaryCaseSchema);
