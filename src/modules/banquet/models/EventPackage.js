const { Schema, model } = require('mongoose');

// Per-headcount pricing — the genuinely new mechanic this module exists to
// exercise. Distribution's PriceTierSchedule makes price a function of
// order QUANTITY (buy more identical units, pay less per unit); this makes
// the total a function of GUEST COUNT for one single line (catering,
// service — priced per person attending, not per unit purchased). Same
// underlying idea (price scales with a number), structurally different
// application, and neither module's code is reused by the other.
const eventPackageSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "Silver Package", "Wedding Deluxe"...
  pricePerPerson: { type: Number, required: true },
  minGuests: { type: Number, default: 1 },
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // trackingMode 'service'
  billingVariantId: { type: Schema.Types.ObjectId, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('EventPackage', eventPackageSchema);
