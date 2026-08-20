const { Schema, model } = require('mongoose');

// Generic approval envelope any module can attach to a document, instead of
// each module (Expense, PurchaseOrder, ...) reinventing its own
// pending/approved/rejected fields. Expense kept its own status field
// because it predates this and approveExpense() already works — this is
// for modules built after it, starting with PurchaseOrder below.
const approvalRequestSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  entityType: { type: String, required: true }, // 'PurchaseOrder', 'PurchaseRequisition', ...
  entityId: { type: Schema.Types.ObjectId, required: true },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  note: String,
}, { timestamps: true });

approvalRequestSchema.index({ entityType: 1, entityId: 1 });

module.exports = model('ApprovalRequest', approvalRequestSchema);
