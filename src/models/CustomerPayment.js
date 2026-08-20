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
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher' },
}, { timestamps: true });

module.exports = model('CustomerPayment', customerPaymentSchema);
