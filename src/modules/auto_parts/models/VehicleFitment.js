const { Schema, model } = require('mongoose');

// A many-to-many compatibility record: which vehicles a part fits. This
// is a genuinely different mechanic than any of the previous 9 modules —
// none of them are a lookup/search problem, they're all billing or
// scheduling. A year RANGE (yearFrom/yearTo), not one row per model year,
// is deliberate — "fits 2015-2020 Corolla" is one record, not six, and the
// match at query time is a simple range containment check
// (yearFrom <= year <= yearTo), not a date-range OVERLAP check like every
// booking module in this app uses — a subtly different kind of range logic.
const vehicleFitmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  variantId: { type: Schema.Types.ObjectId, default: null }, // null = fitment applies to every variant of this product
  make: { type: String, required: true },   // "Toyota"
  model: { type: String, required: true },  // "Corolla"
  yearFrom: { type: Number, required: true },
  yearTo: { type: Number, required: true },
}, { timestamps: true });

vehicleFitmentSchema.index({ companyId: 1, make: 1, model: 1, yearFrom: 1, yearTo: 1 });

module.exports = model('VehicleFitment', vehicleFitmentSchema);
