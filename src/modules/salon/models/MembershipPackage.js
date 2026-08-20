const { Schema, model } = require('mongoose');

// A prepaid bundle of sessions a customer buys upfront (e.g. "10 haircuts
// for PKR 8,000") — a genuinely different pattern from Loyalty's points:
// points are a reward earned passively on any purchase, a membership is a
// deliberate upfront purchase of specific future service credit.
const membershipPackageSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // the sellable line-item selling this package bills as
  variantId: { type: Schema.Types.ObjectId, required: true },
  name: { type: String, required: true },
  salonServiceId: { type: Schema.Types.ObjectId, ref: 'SalonService', required: true }, // which service this package's sessions redeem for
  totalSessions: { type: Number, required: true },
  price: { type: Number, required: true },
  validityDays: { type: Number, default: 365 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('MembershipPackage', membershipPackageSchema);
