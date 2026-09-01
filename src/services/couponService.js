/**
 * CouponService — promo-code CRUD plus the two operations the checkout
 * flow actually needs: validateCoupon() (a pure, read-only check +
 * discount calculation the POS can call to preview a code before
 * finalizing a sale) and recordCouponUsage() (the real, mutating step
 * called only after a sale genuinely completes — same "quote, then a
 * separate explicit step commits the real effect" shape LoyaltyService's
 * redeemPoints()/reverseRedemption() and every draft-then-approve flow in
 * this app already follow).
 */
const mongoose = require('mongoose');
const Coupon = require('../models/Coupon');
const CouponRedemption = require('../models/CouponRedemption');

async function createCoupon(companyId, input) {
  const { code, description, discountType, discountValue, minPurchaseAmount, maxUsageCount, maxUsagePerCustomer, validFrom, validUntil, active } = input;
  if (!code || !code.trim()) throw new Error('code is required.');
  if (!['percent', 'fixed'].includes(discountType)) throw new Error("discountType must be 'percent' or 'fixed'.");
  if (!discountValue || discountValue <= 0) throw new Error('discountValue must be greater than zero.');
  if (discountType === 'percent' && discountValue > 100) throw new Error('A percent discount cannot exceed 100.');

  const existing = await Coupon.findOne({ companyId, code: code.trim().toUpperCase() });
  if (existing) throw new Error(`A coupon with code "${code.trim().toUpperCase()}" already exists.`);

  return Coupon.create({
    companyId, code: code.trim().toUpperCase(), description, discountType, discountValue,
    minPurchaseAmount: minPurchaseAmount || 0,
    maxUsageCount: maxUsageCount === undefined || maxUsageCount === null || maxUsageCount === '' ? null : maxUsageCount,
    maxUsagePerCustomer: maxUsagePerCustomer || 1,
    validFrom: validFrom || null, validUntil: validUntil || null,
    active: active === undefined ? true : active,
  });
}

function listCoupons(companyId, { active } = {}) {
  const filter = { companyId };
  if (active !== undefined) filter.active = active === 'true' || active === true;
  return Coupon.find(filter).sort({ createdAt: -1 });
}

async function setActive(companyId, couponId, active) {
  const coupon = await Coupon.findOneAndUpdate({ _id: couponId, companyId }, { active }, { new: true });
  if (!coupon) throw new Error('Coupon not found.');
  return coupon;
}

/**
 * Pure, read-only check — never mutates usageCount. Returns the coupon
 * plus the calculated discount amount, or throws a clear, specific reason
 * (expired/inactive/below minimum/usage limit reached/already used by
 * this customer) the POS can show the cashier directly.
 */
async function validateCoupon(companyId, code, { customerId, purchaseAmount } = {}) {
  if (!code || !code.trim()) throw new Error('A coupon code is required.');
  if (!purchaseAmount || purchaseAmount <= 0) throw new Error('purchaseAmount must be greater than zero.');

  const coupon = await Coupon.findOne({ companyId, code: code.trim().toUpperCase() });
  if (!coupon) throw new Error(`Coupon "${code.trim().toUpperCase()}" not found.`);
  if (!coupon.active) throw new Error('This coupon is no longer active.');

  const now = new Date();
  if (coupon.validFrom && now < coupon.validFrom) throw new Error('This coupon is not valid yet.');
  if (coupon.validUntil && now > coupon.validUntil) throw new Error('This coupon has expired.');

  if (purchaseAmount < coupon.minPurchaseAmount) {
    throw new Error(`This coupon requires a minimum purchase of ${coupon.minPurchaseAmount}.`);
  }

  if (coupon.maxUsageCount !== null && coupon.usageCount >= coupon.maxUsageCount) {
    throw new Error('This coupon has reached its total usage limit.');
  }

  if (customerId) {
    const customerUsage = await CouponRedemption.countDocuments({ couponId: coupon._id, customerId });
    if (customerUsage >= coupon.maxUsagePerCustomer) {
      throw new Error('This customer has already used this coupon the maximum number of times.');
    }
  }

  const discountAmount = coupon.discountType === 'percent'
    ? Math.round(purchaseAmount * (coupon.discountValue / 100) * 100) / 100
    : Math.min(coupon.discountValue, purchaseAmount);

  return { coupon, discountAmount };
}

/**
 * The real, mutating step — called only after a sale genuinely completes
 * (mirrors loyaltyService.earnPointsForSale being a post-checkout side
 * effect). Increments the fast counter and writes the ledger entry inside
 * one transaction so they can never drift apart.
 */
async function recordCouponUsage(couponId, { companyId, customerId = null, saleId = null, discountAmount }) {
  const session = await mongoose.startSession();
  try {
    let redemption;
    await session.withTransaction(async () => {
      const coupon = await Coupon.findOneAndUpdate(
        { _id: couponId, companyId },
        { $inc: { usageCount: 1 } },
        { new: true, session }
      );
      if (!coupon) throw new Error('Coupon not found.');

      [redemption] = await CouponRedemption.create(
        [{ companyId, couponId, customerId, saleId, discountAmount }],
        { session }
      );
    });
    return redemption;
  } finally {
    session.endSession();
  }
}

module.exports = { createCoupon, listCoupons, setActive, validateCoupon, recordCouponUsage };
