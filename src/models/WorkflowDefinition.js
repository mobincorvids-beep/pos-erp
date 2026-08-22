const { Schema, model } = require('mongoose');

const stepDefinitionSchema = new Schema({
  order: { type: Number, required: true },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
  minAmount: { type: Number, default: 0 }, // this step only applies if the request's amount is >= this — lets a small purchase order skip straight past a step that only matters for large ones
}, { _id: false });

// A company-configured, multi-step approval chain for one entity type —
// "PurchaseOrder requests over 100,000 need both a Manager AND a Finance
// Director to approve, in that order; smaller ones just need a Manager."
// This is the actual configurability that turns the single-step
// pending/approved/rejected envelope ApprovalRequest already had into a
// real workflow engine — steps are defined once here, and every new
// ApprovalRequest for this entityType snapshots whichever steps actually
// apply to its own amount at request time.
const workflowDefinitionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  entityType: { type: String, required: true }, // 'PurchaseOrder', 'Expense', ...
  steps: {
    type: [stepDefinitionSchema],
    validate: {
      validator(steps) {
        if (steps.length === 0) return false;
        for (let i = 1; i < steps.length; i++) if (steps[i].order <= steps[i - 1].order) return false;
        return true;
      },
      message: 'At least one step is required, and step order values must strictly increase.',
    },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

workflowDefinitionSchema.index({ companyId: 1, entityType: 1 }, { unique: true });

module.exports = model('WorkflowDefinition', workflowDefinitionSchema);
