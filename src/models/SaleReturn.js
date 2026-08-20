const { Schema, model } = require('mongoose');

const returnItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  batchId: { type: Schema.Types.ObjectId, ref: 'ProductBatch', default: null },
  serialNumbers: [{ type: String }], // for serial-tracked lines — which specific units came back
  quantity: { type: Number, required: true },
  unitPrice: { type: Number, required: true },
  lineTotal: { type: Number, required: true },
}, { _id: false });

// Kept separate from Sale rather than mutating the original sale's items —
// this preserves the original invoice exactly as billed (required for tax/
// audit purposes) while still supporting partial, multi-part returns.
const saleReturnSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', required: true, index: true },
  returnNumber: { type: String, required: true, unique: true },
  items: [returnItemSchema],
  totalAmount: { type: Number, required: true },
  refundAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  reason: String,
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('SaleReturn', saleReturnSchema);
