const { Schema, model } = require('mongoose');

const rfqLineItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true },
  description: String,
}, { _id: true });

// A Request For Quotation — sent to several suppliers, comparing what
// comes back BEFORE any money commits, the real missing piece before a
// Purchase Order exists at all. Nothing else in core Procurement handles
// "we don't know who's cheapest yet" — every existing purchase flow
// already assumes a supplier has been chosen.
const rfqSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  items: { type: [rfqLineItemSchema], required: true },
  invitedSupplierIds: [{ type: Schema.Types.ObjectId, ref: 'Supplier' }],
  dueDate: Date,
  status: { type: String, default: 'open', enum: ['open', 'closed'] },
}, { timestamps: true });

module.exports = model('RFQ', rfqSchema);
