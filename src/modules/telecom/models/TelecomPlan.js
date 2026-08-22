const { Schema, model } = require('mongoose');

// A plan's included quota and overage rates — the genuinely new mechanic
// this module exists for. Cafe's subscription caps a REDEMPTION COUNT
// (1 free coffee/day, a whole unit either used or not). This is METERED
// CONSUMPTION with a quota and a rate charged only on the excess — a
// customer who uses 550 minutes against a 500-minute plan owes overage
// on exactly 50 minutes, a genuinely different billing shape from
// anything else in this app.
const telecomPlanSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "Postpaid 500"
  monthlyFee: { type: Number, required: true },
  includedMinutes: { type: Number, default: 0 },
  includedDataMB: { type: Number, default: 0 },
  includedSms: { type: Number, default: 0 },
  overageRatePerMinute: { type: Number, default: 0 },
  overageRatePerMB: { type: Number, default: 0 },
  overageRatePerSms: { type: Number, default: 0 },
  billingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // trackingMode 'service' — the base plan fee line
  billingVariantId: { type: Schema.Types.ObjectId, required: true },
  overageBillingProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // a SEPARATE line item, so a bill can clearly show "Plan fee" and "Usage overage" as two distinct, honestly-labeled charges rather than one ambiguous total
  overageBillingVariantId: { type: Schema.Types.ObjectId, required: true },
}, { timestamps: true });

module.exports = model('TelecomPlan', telecomPlanSchema);
