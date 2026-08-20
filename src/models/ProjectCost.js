const { Schema, model } = require('mongoose');

// A cost entry against a project. Most entries are created AUTOMATICALLY —
// when an Expense or a PurchaseOrder/GRN tagged with a projectId is
// approved/received (see expenseService.approveExpense and
// purchaseService.receiveGoods) — rather than requiring someone to
// re-key costs that already exist as real financial documents elsewhere.
// Manual entries (type 'manual') exist for costs with no other document,
// like an internal labor allocation.
const projectCostSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  type: { type: String, required: true, enum: ['material', 'labor', 'expense', 'purchase', 'manual'] },
  amount: { type: Number, required: true },
  referenceType: String, // 'Expense', 'PurchaseOrder', 'GoodsReceivedNote', ...
  referenceId: Schema.Types.ObjectId,
  date: { type: Date, default: Date.now },
  note: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('ProjectCost', projectCostSchema);
