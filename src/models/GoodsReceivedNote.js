const { Schema, model } = require('mongoose');

const grnItemSchema = new Schema({
  purchaseOrderItemId: { type: Schema.Types.ObjectId, required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  quantity: { type: Number, required: true },
  unitCost: { type: Number, required: true },
  // For serial/IMEI-tracked products: one entry per unit received on this
  // line (length must equal quantity — enforced in purchaseService, not
  // here, since that check needs the sibling `quantity` field and Mongoose
  // subdocument validators can't easily reach a sibling). Kept directly on
  // the GRN line (in addition to the ProductSerial records it creates) so
  // "which serials came in on this receipt" doesn't require a separate
  // cross-referenced query.
  serialNumbers: [{ type: String }],
  // Quality check — stock is put on-hand at receiving time (goods are
  // physically present), then QC either confirms it or rejects it, which
  // reverses that portion. This matches real warehouse flow: you don't hold
  // a truck at the gate until QC finishes.
  qcStatus: { type: String, default: 'pending', enum: ['pending', 'passed', 'failed'] },
  qcNote: String,
}, { _id: true });

const grnSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  grnNumber: { type: String, required: true, unique: true },
  receivedDate: { type: Date, required: true },
  items: [grnItemSchema],
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('GoodsReceivedNote', grnSchema);
