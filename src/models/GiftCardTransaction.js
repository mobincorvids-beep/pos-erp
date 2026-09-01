const { Schema, model } = require('mongoose');

// Immutable ledger of every balance-changing event on a GiftCard — issue,
// redeem, or a manual adjustment — mirroring how CustomerLedger/StockLevel
// movements record history alongside a running balance elsewhere in this app.
const giftCardTransactionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  giftCardId: { type: Schema.Types.ObjectId, ref: 'GiftCard', required: true, index: true },
  type: { type: String, required: true, enum: ['issue', 'redeem', 'adjustment'] },
  amount: { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('GiftCardTransaction', giftCardTransactionSchema);
