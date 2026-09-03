const { Schema, model } = require('mongoose');

// CANONICAL for the formal RFQ (request-for-quotation) flow. Both this
// model and SupplierQuote.js were found live in the codebase, wired into
// DIFFERENT flows, not duplicates of each other — see the matching header
// comment on SupplierQuote.js for the full explanation. In short: this one
// hangs off an RFQ sent to multiple suppliers (rfqService.compareQuotations
// picks the cheapest supplier PER LINE ITEM across responses); SupplierQuote
// hangs off a single PurchaseRequisition for simpler ad-hoc quote capture.
const quotedItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  unitPrice: { type: Number, required: true },
  leadTimeDays: Number,
}, { _id: false });

// One supplier's real response to one RFQ — several of these accumulate
// against the same RFQ, and compareQuotations() is what actually makes
// them useful: identifying the cheapest price PER LINE ITEM across every
// quotation received, not just picking one overall "winning" supplier —
// real procurement often ends up buying different items from different
// suppliers on the same RFQ.
const supplierQuotationSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  rfqId: { type: Schema.Types.ObjectId, ref: 'RFQ', required: true, index: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  items: { type: [quotedItemSchema], required: true },
  totalAmount: { type: Number, required: true },
}, { timestamps: true });

supplierQuotationSchema.index({ rfqId: 1, supplierId: 1 }, { unique: true }); // one quotation per supplier per RFQ — resubmitting silently isn't allowed, avoiding ambiguity about which quote is "the real one"

module.exports = model('SupplierQuotation', supplierQuotationSchema);
