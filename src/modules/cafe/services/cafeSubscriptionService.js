/**
 * CafeSubscriptionService — a daily-resetting free-drink allowance. The
 * genuinely new mechanic: redeemDaily() doesn't check a shrinking balance
 * (Salon's MembershipPackage does that — a fixed pool of sessions,
 * consumed whenever, never refilled). This checks whether TODAY
 * specifically has already been used, and the moment the calendar rolls
 * over to a new day, the allowance is back — for the entire life of the
 * subscription, not a one-time pool that eventually runs out.
 */
const CafeSubscription = require('../models/CafeSubscription');
const posSaleService = require('../../../services/posSaleService');
const inventoryService = require('../../../services/inventoryService');

function isSameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Sells the subscription itself — billed once, through the ordinary checkout, like any other purchase. */
async function sellSubscription(input) {
  const {
    companyId, branchId, warehouseId, customerId, planName, startDate, endDate, dailyLimit,
    subscriptionBillingProductId, subscriptionBillingVariantId, subscriptionPrice,
    redeemProductId, redeemVariantId, paymentAccountId, posTerminalId, userId,
  } = input;
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');

  const sale = await posSaleService.checkout({
    companyId, branchId, warehouseId, customerId, posTerminalId, userId,
    items: [{ productId: subscriptionBillingProductId, variantId: subscriptionBillingVariantId, quantity: 1, unitPrice: subscriptionPrice }],
    payments: [{ paymentAccountId, method: 'cash', amount: subscriptionPrice }],
  });

  return CafeSubscription.create({
    companyId, customerId, planName, startDate, endDate, dailyLimit: dailyLimit || 1,
    redeemProductId, redeemVariantId, saleId: sale._id,
  });
}

function listSubscriptions(companyId, { customerId, status } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  return CafeSubscription.find(filter).populate('customerId', 'name').sort({ endDate: -1 });
}

/** Was missing — the status enum already had 'cancelled', nothing ever set it. Cancels
 * (not deletes) a subscription so staff can stop honoring it after a mistaken sale or a
 * customer requesting a refund elsewhere, without losing the record of what was paid. */
async function cancelSubscription(companyId, id) {
  const subscription = await CafeSubscription.findOne({ _id: id, companyId });
  if (!subscription) throw new Error('Subscription not found.');
  if (subscription.status === 'cancelled') throw new Error('Already cancelled.');
  subscription.status = 'cancelled';
  await subscription.save();
  return subscription;
}

/**
 * The actual daily-cap check. Three real branches:
 *   - subscription has expired (past endDate) -> reject
 *   - lastRedemptionDate is a DIFFERENT calendar day than today -> the
 *     allowance has reset; this redemption counts as #1 today
 *   - lastRedemptionDate IS today, and redemptionsToday already hit
 *     dailyLimit -> reject, nothing left for today
 * A successful redemption gives away one real unit of the redeem product —
 * a genuine inventory deduction (someone is handed a real drink), even
 * though no money changes hands on this specific transaction (already
 * paid for via the subscription fee).
 */
async function redeemDaily(subscriptionId, { warehouseId, userId }) {
  const subscription = await CafeSubscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found.');
  if (subscription.status !== 'active') throw new Error(`Cannot redeem against a subscription with status "${subscription.status}".`);

  const now = new Date();
  if (now > subscription.endDate) {
    subscription.status = 'expired';
    await subscription.save();
    throw new Error(`This subscription expired on ${subscription.endDate.toDateString()}.`);
  }
  if (now < subscription.startDate) throw new Error(`This subscription doesn't start until ${subscription.startDate.toDateString()}.`);

  const isNewDay = !subscription.lastRedemptionDate || !isSameCalendarDay(subscription.lastRedemptionDate, now);

  if (!isNewDay && subscription.redemptionsToday >= subscription.dailyLimit) {
    throw new Error(`Today's allowance (${subscription.dailyLimit}) has already been used — resets tomorrow.`);
  }

  // A free redemption still has to respect real stock — giving away a
  // drink that isn't actually there to give is the same bug checkout
  // itself guards against; recordMovement() alone never checks this on
  // its own, the caller always has to (see posSaleService.checkout()'s
  // own explicit call to this before ever touching a movement).
  await inventoryService.assertSufficientStock(warehouseId, subscription.redeemVariantId, null, 1);

  await inventoryService.recordMovement({
    companyId: subscription.companyId, warehouseId,
    productId: subscription.redeemProductId, variantId: subscription.redeemVariantId,
    type: 'sale', quantity: -1,
    referenceType: 'CafeSubscription', referenceId: subscription._id, userId,
    note: 'Daily subscription redemption — no charge, already paid for via the subscription fee',
  });

  subscription.redemptionsToday = isNewDay ? 1 : subscription.redemptionsToday + 1;
  subscription.lastRedemptionDate = now;
  subscription.totalRedemptions += 1;
  await subscription.save();

  return subscription;
}

module.exports = { sellSubscription, listSubscriptions, cancelSubscription, redeemDaily };
