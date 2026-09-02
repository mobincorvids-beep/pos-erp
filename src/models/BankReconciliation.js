const { Schema, model } = require('mongoose');

// One row of an imported bank statement (CSV). `amount` is signed the way a
// bank statement shows it: positive = money in (deposit/credit), negative =
// money out (withdrawal/debit) — see bankStatementService for the CSV
// sniffing that produces this. `matchedEntryIndex` points at the specific
// entry inside `matchedVoucherId`'s `entries` array (ledger entries have no
// _id of their own), so a voucher with several lines on this account can
// still have each one matched to a different statement row.
const statementLineSchema = new Schema({
  date: { type: Date, required: true },
  description: { type: String, default: '' },
  amount: { type: Number, required: true },
  status: { type: String, default: 'unmatched', enum: ['unmatched', 'matched', 'no_match'] },
  matchedVoucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  matchedEntryIndex: { type: Number, default: null },
  matchConfidence: { type: String, default: null, enum: [null, 'auto', 'manual'] },
});

// Marks which vouchers touching a payment account have "cleared" per the
// bank/mobile-wallet statement, so the book balance can be checked against
// what the bank actually shows for a given cutoff date.
const bankReconciliationSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  statementDate: { type: Date, required: true },
  statementBalance: { type: Number, required: true },
  clearedVoucherIds: [{ type: Schema.Types.ObjectId, ref: 'Voucher' }],
  statementLines: [statementLineSchema], // imported CSV rows + their match state
  status: { type: String, default: 'in_progress', enum: ['in_progress', 'completed'] },
  bookBalanceAtCompletion: Number, // snapshotted when completed
  difference: Number,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  completedAt: Date,
}, { timestamps: true });

module.exports = model('BankReconciliation', bankReconciliationSchema);
