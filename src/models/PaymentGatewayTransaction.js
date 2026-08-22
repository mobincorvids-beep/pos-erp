const { Schema, model } = require('mongoose');

// Tracks one online-payment attempt through a Pakistani mobile-wallet
// gateway (JazzCash / Easypaisa), from initiation through the provider's
// callback. saleId is nullable — a transaction is created and sent to the
// provider BEFORE the sale is finalized (the customer still needs to
// approve/complete the payment on their phone), so at creation time there
// may be no Sale document yet at all; the frontend links saleId once
// checkout actually runs (typically only after status is 'completed').
const paymentGatewayTransactionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null, index: true },
  provider: { type: String, enum: ['jazzcash', 'easypaisa'], required: true },
  providerTransactionId: { type: String, default: null, index: true },
  orderRef: { type: String, required: true, index: true }, // our own reference sent to the provider as pp_TxnRefNo / orderId
  phone: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending', index: true },
  responseCode: { type: String, default: null },
  responseMessage: { type: String, default: null },
  rawResponse: { type: Schema.Types.Mixed, default: null }, // full provider payload, kept for audit/debugging — never displayed to the customer
  initiatedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('PaymentGatewayTransaction', paymentGatewayTransactionSchema);
