const { Schema, model } = require('mongoose');

const expenseCategorySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // Rent, Salaries, Utilities...
  // Which expense account in the chart of accounts this category posts to.
  // Required so approveExpense() always knows the debit side of the voucher —
  // no falling back to name-matching like the purchase/report services do.
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
}, { timestamps: true });

module.exports = model('ExpenseCategory', expenseCategorySchema);
