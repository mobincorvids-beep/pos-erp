const { Schema, model } = require('mongoose');

/**
 * A billable milestone on a Project — "Foundation complete: 20% of
 * contract", "Handover: remaining 30%". billingType decides how
 * projectBillingService computes the invoice amount when the milestone is
 * billed: a flat amount, or a percentage of Project.contractValue.
 */
const projectMilestoneSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  name: { type: String, required: true },
  sequence: { type: Number, default: 0 },
  dueDate: { type: Date, default: null },

  billingType: { type: String, required: true, enum: ['fixed_amount', 'percent_of_contract'] },
  amount: { type: Number, default: 0 }, // used when billingType is 'fixed_amount'
  percentOfContract: { type: Number, default: 0 }, // used when billingType is 'percent_of_contract', 0-100

  status: { type: String, default: 'pending', enum: ['pending', 'in_progress', 'completed', 'billed'] },
  completedAt: { type: Date, default: null },
  projectInvoiceId: { type: Schema.Types.ObjectId, ref: 'ProjectInvoice', default: null }, // set once billed
}, { timestamps: true });

projectMilestoneSchema.index({ companyId: 1, projectId: 1, sequence: 1 });

module.exports = model('ProjectMilestone', projectMilestoneSchema);
