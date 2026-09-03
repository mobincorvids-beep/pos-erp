const { Schema, model } = require('mongoose');

// A receipt from a customer, applied against one or more of their
// outstanding sales. Kept separate from Sale.payments (which are payments
// made AT the time of sale) because a customer paying off an old due
// balance days later isn't part of any single sale transaction.
const allocationSchema = new Schema({
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true },
  amount: { type: Number, required: true }, // portion of this payment applied to that sale
}, { _id: false });

const customerPaymentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  allocations: [allocationSchema], // must sum to <= amount
  note: String,
  // How the receipt was actually tendered — Pakistani retail/wholesale
  // depth beyond plain cash/bank: mobile wallets and cheques are common
  // enough here to be first-class rather than lumped into 'bank_transfer'.
  method: { type: String, enum: ['cash', 'card', 'bank_transfer', 'jazzcash', 'easypaisa', 'cheque'], default: 'cash' },
  // Pointer to whatever backs this payment for methods that need one: a
  // PaymentGatewayTransaction._id/providerTransactionId for jazzcash/
  // easypaisa, a Cheque._id for cheque. Unused for cash/card/bank_transfer.
  reference: { type: String, default: null },
  // True once a 'cheque' payment has been reversed by chequeService after
  // the cheque bounced — the row and its Sale allocations stay for audit
  // history, but chequeService.markBounced() posts compensating entries
  // and flags this so a bounced receipt is never treated as good money.
  reversed: { type: Boolean, default: false },
  reversedAt: { type: Date, default: null },
  reversalVoucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher' },
}, { timestamps: true });

module.exports = model('CustomerPayment', customerPaymentSchema);
