const { Schema, model } = require('mongoose');

// The purchasing-side mirror of CreditNote — a formal document reducing
// what the company owes a supplier. Can be issued standalone (a pricing
// dispute, damaged-goods credit not yet returned, a billing correction)
// or linked to a specific PurchaseOrder.
const debitNoteSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  noteNumber: { type: String, required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  reason: { type: String, default: '' },
  amount: { type: Number, required: true },
  apAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true }, // Accounts Payable — debited (reduces what's owed to the supplier)
  expenseAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true }, // Inventory/Expense — credited (reverses the original cost)
  status: { type: String, default: 'issued', enum: ['issued', 'applied', 'void'] },
  appliedToPurchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  appliedAt: { type: Date, default: null },
  voidedAt: { type: Date, default: null },
  voidReason: { type: String, default: '' },
  issuedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

debitNoteSchema.index({ companyId: 1, noteNumber: 1 }, { unique: true });

module.exports = model('DebitNote', debitNoteSchema);
