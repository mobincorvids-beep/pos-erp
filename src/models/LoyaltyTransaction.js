const { Schema, model } = require('mongoose');

// Immutable log of every points change — same "ledger, not just a counter"
// pattern as StockMovement/Voucher, so Customer.loyaltyPoints is always
// reconstructible/auditable rather than being the only record.
const loyaltyTransactionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  type: { type: String, required: true, enum: ['earn', 'redeem', 'adjustment', 'expire'] },
  points: { type: Number, required: true }, // +ve = earn/adjustment-up, -ve = redeem/expire
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  note: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('LoyaltyTransaction', loyaltyTransactionSchema);
