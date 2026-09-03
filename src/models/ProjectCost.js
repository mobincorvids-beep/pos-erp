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
  type: { type: String, required: true, enum: ['material', 'labor', 'expense', 'purchase', 'manual', 'subcontractor'] },
  amount: { type: Number, required: true },
  referenceType: String, // 'Expense', 'PurchaseOrder', 'GoodsReceivedNote', ...
  referenceId: Schema.Types.ObjectId,
  date: { type: Date, default: Date.now },
  note: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },

  // Subcontractor cost tracking: set only when this cost entry came from an
  // Expense or PurchaseOrder tagged with a subcontractorId (see Expense and
  // PurchaseOrder models). subcontractorId denormalizes the source
  // document's tag so getProjectSubcontractorCosts() can aggregate by
  // subcontractor without a join back to Expense/PurchaseOrder.
  // retentionAmount is the holdback withheld from THIS cost entry (not the
  // whole contract) until final acceptance; retentionReleased marks it as
  // paid out once the subcontractor is cleared.
  subcontractorId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null, index: true },
  retentionPercent: { type: Number, default: 0 },
  retentionAmount: { type: Number, default: 0 },
  retentionReleased: { type: Boolean, default: false },
  retentionReleasedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = model('ProjectCost', projectCostSchema);
