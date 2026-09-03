const { Schema, model } = require('mongoose');

// A Return Merchandise Authorization — the customer-initiated "I want to
// send this back" request/approval workflow, distinct from SaleReturn
// (the immediate, already-processed, POS-counter return) and from
// CreditNote (the accounting document). An RMA models a lifecycle with
// real states (requested -> approved -> received -> refunded, or
// rejected at any point before received) instead of a single atomic
// action, matching how mail-order/e-commerce returns actually work: a
// customer asks first, staff decide, goods travel back, then money moves.
const rmaItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 },
  reason: { type: String, default: '' },
}, { _id: false });

const rmaSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  rmaNumber: { type: String, required: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  items: {
    type: [rmaItemSchema],
    validate: { validator: (arr) => arr && arr.length > 0, message: 'An RMA must contain at least one item.' },
  },
  status: {
    type: String,
    default: 'requested',
    enum: ['requested', 'approved', 'received', 'refunded', 'rejected'],
  },
  requestedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  receivedAt: { type: Date, default: null },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', default: null }, // where returned stock is received back into (required by the time status -> received)
  refundAmount: { type: Number, default: null },
  creditNoteId: { type: Schema.Types.ObjectId, ref: 'CreditNote', default: null },
  rejectedReason: { type: String, default: null },
  notes: { type: String, default: '' },
}, { timestamps: true });

rmaSchema.index({ companyId: 1, rmaNumber: 1 }, { unique: true });

module.exports = model('RMA', rmaSchema);
