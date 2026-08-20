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
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher' },
}, { timestamps: true });

module.exports = model('SupplierPayment', supplierPaymentSchema);
