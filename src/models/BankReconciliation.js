const { Schema, model } = require('mongoose');

// Marks which vouchers touching a payment account have "cleared" per the
// bank/mobile-wallet statement, so the book balance can be checked against
// what the bank actually shows for a given cutoff date.
const bankReconciliationSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  statementDate: { type: Date, required: true },
  statementBalance: { type: Number, required: true },
  clearedVoucherIds: [{ type: Schema.Types.ObjectId, ref: 'Voucher' }],
  status: { type: String, default: 'in_progress', enum: ['in_progress', 'completed'] },
  bookBalanceAtCompletion: Number, // snapshotted when completed
  difference: Number,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,
}, { timestamps: true });

module.exports = model('BankReconciliation', bankReconciliationSchema);
