const { Schema, model } = require('mongoose');

// A CAPA line item — a single corrective or preventive action tracked
// against a NonConformance to closure. An NCR can carry several of
// these (e.g. one corrective fix now, one preventive change to stop it
// recurring). Closing the parent NCR requires at least one of these to
// reach 'verified' — enforced in qualityService, not here.
const correctiveActionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  ncrId: { type: Schema.Types.ObjectId, ref: 'NonConformance', required: true, index: true },

  actionType: { type: String, required: true, enum: ['corrective', 'preventive'] },
  description: { type: String, required: true },

  assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  dueDate: { type: Date, default: null },

  status: { type: String, default: 'open', enum: ['open', 'in_progress', 'completed', 'verified'] },
  completedAt: { type: Date, default: null },

  verifiedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  verifiedAt: { type: Date, default: null },
  // Did the action actually work? Filled in at verification — the real
  // quality-ops check, not a rubber stamp on "completed".
  effectivenessNote: { type: String, default: null },
}, { timestamps: true });

module.exports = model('CorrectiveAction', correctiveActionSchema);
