const { Schema, model } = require('mongoose');

// Immutable ledger of who redeemed which coupon — same "ledger, not just
// a counter" pattern LoyaltyTransaction uses against Customer.loyaltyPoints.
// Coupon.usageCount is the fast running total; this is what
// maxUsagePerCustomer is actually enforced against and what makes total
// usage auditable/reconstructible.
const couponRedemptionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  couponId: { type: Schema.Types.ObjectId, ref: 'Coupon', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  saleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
  discountAmount: { type: Number, required: true },
}, { timestamps: true });

module.exports = model('CouponRedemption', couponRedemptionSchema);
