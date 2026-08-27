const { Schema, model } = require('mongoose');

// A real promo-code entity — genuinely different from loyalty points:
// loyalty is a per-customer running balance earned/redeemed over time,
// a coupon is a shared, company-defined code ("SAVE10") anyone can key in
// at checkout, with its own usage caps and validity window. usageCount is
// a running counter incremented by recordCouponUsage() — the ledger of
// *who* used it lives in CouponRedemption, same "counter + ledger" split
// LoyaltyTransaction already established for points.
const couponSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  code: { type: String, required: true, uppercase: true, trim: true },
  description: { type: String, default: '' },
  discountType: { type: String, required: true, enum: ['percent', 'fixed'] },
  discountValue: { type: Number, required: true },
  minPurchaseAmount: { type: Number, default: 0 },
  // null = unlimited total redemptions across all customers
  maxUsageCount: { type: Number, default: null },
  usageCount: { type: Number, default: 0 },
  maxUsagePerCustomer: { type: Number, default: 1 },
  validFrom: { type: Date, default: null },
  validUntil: { type: Date, default: null },
  active: { type: Boolean, default: true },
}, { timestamps: true });

// A code is unique per company, not globally — two companies on this
// platform can both run "SAVE10" independently.
couponSchema.index({ companyId: 1, code: 1 }, { unique: true });

module.exports = model('Coupon', couponSchema);
