const { Schema, model } = require('mongoose');

const supplierSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  phone: String,
  email: String,
  address: String,
  openingBalance: { type: Number, default: 0 }, // +ve = company owes supplier

  // Typical time between placing a PO with this supplier and the goods
  // actually arriving. Additive/optional — 0 means "not tracked", so every
  // existing supplier and every prior read of this document is unaffected.
  // reorderRuleService.listBelowReorderPoint() reads this to flag stock
  // that's projected to run out before a fresh PO could realistically land.
  leadTimeDays: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = model('Supplier', supplierSchema);
