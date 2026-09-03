const { Schema, model } = require('mongoose');

// A requested change to a project's scope/budget — e.g. "add 200sqft of
// flooring, +$4,200". Starts 'pending'; once approved, its budgetImpact
// (positive or negative) is applied to Project.budget by
// changeOrderService.approveChangeOrder, and the adjustment is logged as a
// ProjectCost-adjacent note (see that function) so the budget's history
// stays auditable instead of just silently changing a number.
const changeOrderSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  description: { type: String, required: true },
  // Signed amount: positive increases the project budget, negative reduces it.
  budgetImpact: { type: Number, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: '' },
}, { timestamps: true });

module.exports = model('ChangeOrder', changeOrderSchema);
