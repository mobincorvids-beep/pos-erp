const { Schema, model } = require('mongoose');

// An append-only ledger of every donation and disbursement against one
// fund — the real audit trail a donor or auditor would actually want to
// see for "where did the money to this specific fund come from, and
// where did it go", not just a single running balance number with no history.
const fundTransactionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  fundId: { type: Schema.Types.ObjectId, ref: 'Fund', required: true, index: true },
  type: { type: String, required: true, enum: ['donation', 'disbursement'] },
  amount: { type: Number, required: true },
  donorCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null }, // only set for donations
  description: { type: String, required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', required: true },
}, { timestamps: true });

module.exports = model('FundTransaction', fundTransactionSchema);
