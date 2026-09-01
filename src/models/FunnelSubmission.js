const { Schema, model } = require('mongoose');

// One row per public form submission on a Funnel landing page. `data` is
// kept as a free-form object (Mixed) rather than modeled fields because
// its shape is whatever that Funnel's formFields happen to be at submit
// time — the same reason Campaign/other flexible-input models in this
// codebase don't try to pre-declare every possible field.
const funnelSubmissionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  funnelId: { type: Schema.Types.ObjectId, ref: 'Funnel', required: true, index: true },
  data: { type: Schema.Types.Mixed, default: {} }, // submitted form values keyed by formFields[].key
  // Set once submitFunnel() converts this submission into a real CRM Lead
  // (crmPipelineService.createLead) — mirrors Lead.convertedCustomerId's
  // pattern of linking forward once the real record exists.
  leadId: { type: Schema.Types.ObjectId, ref: 'Lead', default: null },
  convertedAt: { type: Date, default: null },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

funnelSubmissionSchema.index({ companyId: 1, funnelId: 1, submittedAt: -1 });

module.exports = model('FunnelSubmission', funnelSubmissionSchema);
