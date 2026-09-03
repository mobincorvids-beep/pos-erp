const { Schema, model } = require('mongoose');

// CANONICAL for the direct requisition-to-quote flow. Both this model and
// SupplierQuotation.js were found live in the codebase, wired into
// DIFFERENT flows, not duplicates of each other:
//   - SupplierQuote (here): attaches straight to ONE PurchaseRequisition
//     (requisitionId) — requisitionService.submitQuote/compareQuotes lets
//     a buyer collect ad-hoc quotes against a single requisition, one
//     quote at a time, no formal multi-supplier bidding round.
//   - SupplierQuotation (SupplierQuotation.js): attaches to an RFQ
//     (rfqId), the formal "send this to N suppliers, compare responses
//     per line item" flow (see rfqService/RFQ.js).
// Neither is dead code, so neither was merged or removed — see the header
// comment on SupplierQuotation.js for the same note from the other side.
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
