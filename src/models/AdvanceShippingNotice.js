const { Schema, model } = require('mongoose');

/**
 * ASN — a supplier's advance notice of what they're about to ship, ahead of
 * physically receiving it. Purely additive: an ASN does not create or
 * require a GoodsReceivedNote, and receiving via purchaseService.receiveGoods
 * works exactly as before whether or not an ASN exists — see
 * asnService.matchGrnToAsn for the optional, after-the-fact variance check
 * a receiving clerk can run once a GRN has been posted.
 */
const asnExpectedItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null },
  expectedQuantity: { type: Number, required: true },
}, { _id: true });

const asnSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  purchaseOrderId: { type: Schema.Types.ObjectId, ref: 'PurchaseOrder', default: null },
  asnNumber: { type: String, required: true },
  expectedItems: [asnExpectedItemSchema],
  expectedArrivalDate: { type: Date, default: null },
  status: { type: String, default: 'pending', enum: ['pending', 'received', 'partial'] },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

asnSchema.index({ companyId: 1, asnNumber: 1 }, { unique: true });
asnSchema.index({ companyId: 1, purchaseOrderId: 1 });

module.exports = model('AdvanceShippingNotice', asnSchema);
