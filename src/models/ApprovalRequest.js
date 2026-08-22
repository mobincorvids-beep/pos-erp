const { Schema, model } = require('mongoose');

const stepDecisionSchema = new Schema({
  stepOrder: { type: Number, required: true },
  // Optional here (unlike WorkflowDefinition's own step definitions, where
  // a roleId is required) — a request created with NO matching
  // WorkflowDefinition falls back to a single implicit step with no role
  // target at all, exactly matching the old single-step behavior where
  // anyone with the right PERMISSION (enforced separately, at the route
  // level) could decide it. This is what makes the upgrade genuinely
  // backward compatible rather than just claimed to be — an existing
  // caller that never passes a role keeps working exactly as before.
  roleId: { type: Schema.Types.ObjectId, ref: 'Role', default: null },
  decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  decision: { type: String, default: null, enum: [null, 'approved', 'rejected'] },
  decidedAt: { type: Date, default: null },
  note: String,
}, { _id: false });

// Generic approval envelope any module can attach to a document, instead of
// each module (Expense, PurchaseOrder, ...) reinventing its own
// pending/approved/rejected fields. Expense kept its own status field
// because it predates this and approveExpense() already works — this is
// for modules built after it, starting with PurchaseOrder below.
//
// Upgraded from strictly single-step to a real multi-step chain — `steps`
// is a SNAPSHOT taken at request time from any matching WorkflowDefinition
// (same "snapshot the terms, don't re-derive them later" convention this
// whole app already uses — Hotel's ratePerNight, Layaway's totalPrice — so
// a workflow definition changing later never retroactively alters an
// in-flight approval). If no WorkflowDefinition exists for this
// entityType, `steps` has exactly one implicit entry and the whole thing
// behaves exactly like the old single-step version — genuinely backward
// compatible, not a breaking change for PurchaseOrder's existing usage.
const approvalRequestSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  entityType: { type: String, required: true }, // 'PurchaseOrder', 'PurchaseRequisition', ...
  entityId: { type: Schema.Types.ObjectId, required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, default: null }, // drives which steps actually apply, via each step's minAmount
  steps: [stepDecisionSchema],
  currentStepIndex: { type: Number, default: 0 },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  // Kept for backward compatibility with any existing code reading these
  // directly — mirrors the FINAL decision once the whole chain resolves.
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  note: String,
}, { timestamps: true });

approvalRequestSchema.index({ entityType: 1, entityId: 1 });

module.exports = model('ApprovalRequest', approvalRequestSchema);
