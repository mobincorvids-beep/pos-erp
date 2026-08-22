const { Schema, model } = require('mongoose');

// One account's budgeted amount for one real month — deliberately at the
// same granularity real accounting already works at (account × period),
// not a separate parallel structure. budgetVsActual() compares this
// against REAL Voucher entries for that same account and month — the
// exact same source of truth trialBalance/profitAndLoss/costCenter
// reports already read, never a second, independently-tracked "actual" number.
const budgetLineSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  month: { type: Number, required: true, min: 1, max: 12 },
  year: { type: Number, required: true },
  budgetedAmount: { type: Number, required: true },
}, { timestamps: true });

budgetLineSchema.index({ companyId: 1, accountId: 1, month: 1, year: 1 }, { unique: true }); // one real budget per account per month — setting it again is an update, never a silent duplicate

module.exports = model('BudgetLine', budgetLineSchema);
