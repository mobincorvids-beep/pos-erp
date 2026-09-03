const { Schema, model } = require('mongoose');

// A cheque received from a customer (receivable) or issued to a supplier
// (payable) — a common tender in Pakistani wholesale/retail alongside cash
// and mobile wallets. Always backs exactly one CustomerPayment or
// SupplierPayment (never both), created together by chequeService so the
// normal ledger math (Sale.dueAmount / PurchaseOrder.dueAmount) already
// reflects the cheque as received/paid the moment it's deposited — status
// here just tracks whether the bank has actually honored it yet.
const chequeSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  direction: { type: String, enum: ['receivable', 'payable'], required: true }, // receivable = from a customer, payable = to a supplier
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', default: null },
  customerPaymentId: { type: Schema.Types.ObjectId, ref: 'CustomerPayment', default: null },
  supplierPaymentId: { type: Schema.Types.ObjectId, ref: 'SupplierPayment', default: null },
  chequeNumber: { type: String, required: true },
  bankName: { type: String, required: true },
  chequeDate: { type: Date, required: true }, // the date printed on the cheque
  dueDate: { type: Date, required: true }, // when it should be presented/cleared — drives the "due this week" view
  amount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'cleared', 'bounced'], default: 'pending', index: true },
  clearedAt: { type: Date, default: null },
  bouncedAt: { type: Date, default: null },
  bounceReason: { type: String, default: null },
  note: { type: String, default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // who recorded it
}, { timestamps: true });

chequeSchema.index({ companyId: 1, status: 1, dueDate: 1 });

module.exports = model('Cheque', chequeSchema);
