const { Schema, model } = require('mongoose');

const requisitionItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantityRequested: { type: Number, required: true },
  note: String,
}, { _id: false });

// The "someone needs to buy X" step, before a supplier or price is even
// chosen — separate from PurchaseOrder because a requisition doesn't commit
// to a supplier or a cost yet; SupplierQuote below is what adds those.
const purchaseRequisitionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  requisitionNumber: { type: String, required: true, unique: true },
  items: [requisitionItemSchema],
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected', 'converted'] },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  // DEPRECATED: these two used to be the entire approval mechanism (a flat
  // "who approved it, when" pair set directly by requisitionService.decide).
  // Approval decisions now flow through the real multi-step ApprovalService
  // workflow engine (same one PurchaseOrder uses — see approvalService.js /
  // ApprovalRequest), which is the primary path. These fields are kept,
  // read-only from the new flow's perspective, purely so existing
  // documents and any old code still reading them directly don't break;
  // they're mirrored from the final ApprovalRequest decision but should no
  // longer be treated as the source of truth.
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  note: String,
}, { timestamps: true });

module.exports = model('PurchaseRequisition', purchaseRequisitionSchema);
