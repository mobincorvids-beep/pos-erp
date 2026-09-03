const { Schema, model } = require('mongoose');

// "Secondary sales" = what a retailer/shop (our Customer) reports having
// sold onward to end consumers, for one product over one period — distinct
// from "primary sales" (what WE sold the shop, i.e. an ordinary Sale doc).
// Deliberately just a reported number, not derived from any other ledger —
// a distributor typically gets this from the shopkeeper verbally or via a
// field rep's visit, there's no automated source for it.
const secondarySaleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  period: { type: String, required: true }, // "2026-08" (calendar month) — free-text so a week/quarter label also fits
  quantitySold: { type: Number, required: true, min: 0 },
  recordedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  note: String,
}, { timestamps: true });

secondarySaleSchema.index({ companyId: 1, customerId: 1, productId: 1, period: 1 }, { unique: true });

module.exports = model('SecondarySale', secondarySaleSchema);
