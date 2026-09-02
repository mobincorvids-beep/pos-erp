const { Schema, model } = require('mongoose');

/**
 * CrmAutomationRule — simple "when X happens in the pipeline, do Y"
 * rules, HubSpot-workflow-lite. Kept deliberately narrow for v1: one
 * trigger shape (a stage change landing on a specific stage) and two
 * action shapes (send an email, create a follow-up task). Evaluated and
 * fired synchronously, inline, right where the stage actually changes
 * (crmPipelineService.updateOpportunityStage) — no queue/worker, matching
 * "breadth not depth": a rule firing one email or one task per stage
 * change is cheap enough to just do inline.
 */
const crmAutomationRuleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  active: { type: Boolean, default: true },

  trigger: {
    type: { type: String, required: true, enum: ['stage_changed'], default: 'stage_changed' },
    toStage: { type: String, required: true, enum: ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'] },
  },

  action: {
    type: { type: String, required: true, enum: ['send_email', 'create_task'] },
    // send_email: sent to the opportunity's customer via messagingService.
    subject: { type: String, default: '' },
    message: { type: String, default: '' }, // supports {{title}}, {{customerName}}, {{estimatedValue}}, {{stage}} placeholders
    // create_task: Task is a project-scoped model elsewhere in this app, so
    // "task" here means a CustomerFollowUp against the opportunity's
    // customer — the existing lightweight task-like record CRM already has.
    taskNote: { type: String, default: '' },
    taskDueInDays: { type: Number, default: 3, min: 0 },
    assignedToUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },

  createdByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

crmAutomationRuleSchema.index({ companyId: 1, active: 1, 'trigger.toStage': 1 });

module.exports = model('CrmAutomationRule', crmAutomationRuleSchema);
