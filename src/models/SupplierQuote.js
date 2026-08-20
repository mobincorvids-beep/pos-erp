const { Schema, model } = require('mongoose');

const quoteItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quotedUnitCost: { type: Number, required: true },
  leadTimeDays: Number,
}, { _id: false });

const supplierQuoteSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  requisitionId: { type: Schema.Types.ObjectId, ref: 'PurchaseRequisition', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: [quoteItemSchema],
  validUntil: Date,
  status: { type: String, default: 'submitted', enum: ['submitted', 'accepted', 'rejected'] },
}, { timestamps: true });

module.exports = model('SupplierQuote', supplierQuoteSchema);
