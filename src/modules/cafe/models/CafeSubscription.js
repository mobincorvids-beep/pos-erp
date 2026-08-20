const { Schema, model } = require('mongoose');

// A "1 free drink a day" membership — genuinely different temporal shape
// from Salon's MembershipPackage, which depletes a fixed total pool of
// sessions redeemed whenever (a shrinking balance). This isn't a balance
// at all: dailyLimit resets every single calendar day for the whole life
// of the subscription, and the check is "has TODAY specifically already
// been used," not "how many are left." lastRedemptionDate is the whole
// mechanism — see cafeSubscriptionService.redeemDaily().
const cafeSubscriptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
  planName: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  dailyLimit: { type: Number, default: 1 },
  redeemProductId: { type: Schema.Types.ObjectId, ref: 'Product', required: true }, // what a redemption gives away
  redeemVariantId: { type: Schema.Types.ObjectId, required: true },
  lastRedemptionDate: { type: Date, default: null }, // the calendar day of the most recent redemption
  redemptionsToday: { type: Number, default: 0 }, // resets to 0 whenever a redemption happens on a NEW day — see redeemDaily()
  totalRedemptions: { type: Number, default: 0 }, // lifetime count, purely informational
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null }, // the sale that paid for the subscription itself
  status: { type: String, default: 'active', enum: ['active', 'expired', 'cancelled'] },
}, { timestamps: true });

module.exports = model('CafeSubscription', cafeSubscriptionSchema);
