const { Schema, model } = require('mongoose');

const allocationSchema = new Schema({
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  amount: { type: Number, required: true },
}, { _id: false });

const supplierPaymentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  paymentAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  allocations: [allocationSchema],
  note: String,
  // Symmetric with CustomerPayment.method — a supplier can be paid back
  // via cheque/mobile wallet just as often as cash/bank in this market.
  method: { type: String, enum: ['cash', 'card', 'bank_transfer', 'jazzcash', 'easypaisa', 'cheque'], default: 'cash' },
  reference: { type: String, default: null }, // Cheque._id for method 'cheque', provider txn id for jazzcash/easypaisa
  reversed: { type: Boolean, default: false }, // set by chequeService.markBounced() for a bounced cheque
  reversedAt: { type: Date, default: null },
  reversalVoucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher' },
}, { timestamps: true });

module.exports = model('SupplierPayment', supplierPaymentSchema);
