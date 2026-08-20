const { Schema, model } = require('mongoose');

// A car showroom's trade-in — structurally identical to Jewelry's
// BuybackTransaction (intake -> credit -> apply-as-a-discount at the next
// checkout, the same pattern loyalty redemption established originally),
// but the VALUATION differs and genuinely can't be reused: Jewelry's
// credit is rate × weight, a formula; a car's trade-in value has no
// formula at all — it's an appraiser's judgment call entered directly.
// This is the one real, new piece Automobile needed; everything else
// (VIN-tracked inventory, selling a vehicle) is already core, unchanged.
const tradeInCreditSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  vehicleDescription: String, // "2018 Honda Civic, VIN ..."
  appraisedValue: { type: Number, required: true }, // entered directly by whoever appraised it — no formula behind this number
  status: { type: String, default: 'pending', enum: ['pending', 'applied', 'cancelled'] },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  userId: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = model('TradeInCredit', tradeInCreditSchema);
