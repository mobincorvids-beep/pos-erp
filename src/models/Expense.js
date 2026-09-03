const { Schema, model } = require('mongoose');

const expenseSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  categoryId: { type: Schema.Types.ObjectId, ref: 'ExpenseCategory', required: true },
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null }, // tags this expense for job costing; a ProjectCost is auto-created on approval

  // Subcontractor cost tagging — set alongside projectId when this expense
  // is a bill from a subcontractor/job-worker (a Supplier, same convention
  // as SubcontractOrder.supplierId) rather than a generic project expense.
  // When set, approveExpense() creates a 'subcontractor'-typed ProjectCost
  // instead of 'expense', so subcontractor spend can be reported on
  // separately from labor/material (see projectService.getProjectSubcontractorCosts).
  // retentionPercent/retentionAmount is the holdback withheld from THIS
  // bill until final acceptance — retentionAmount takes precedence when
  // both are given, otherwise it's computed as amount * retentionPercent / 100.
  subcontractorId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  retentionPercent: { type: Number, default: 0 },
  retentionAmount: { type: Number, default: 0 },

  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  note: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' }, // who submitted it

  // Approval workflow — an expense only hits the ledger once approved, so a
  // submitted-but-rejected expense never affects accounts.
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  rejectionReason: { type: String, default: null },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null }, // set once posted
}, { timestamps: true });

module.exports = model('Expense', expenseSchema);
