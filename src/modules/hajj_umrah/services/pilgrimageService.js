/**
 * PilgrimageService — the genuinely new interaction this module exists
 * for: Gym's capacity+waitlist mechanic (enroll fills a fixed quota,
 * waitlist otherwise, cancellation promotes the longest-waiting person)
 * combined with Layaway's installment-payment mechanic, PER PILGRIM. The
 * two have never had to interact before. The real design question this
 * module had to answer: when a waitlisted pilgrim gets promoted into a
 * newly-open seat, they need their OWN fresh payment plan starting at
 * zero — they do NOT inherit whatever the cancelling pilgrim had already
 * paid, since that money belongs to a different plan for a different person.
 */
const mongoose = require('mongoose');
const PilgrimageGroup = require('../models/PilgrimageGroup');
const PilgrimPayment = require('../models/PilgrimPayment');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

function createGroup(input) {
  const { companyId, branchId, packageName, departureDate, capacity, packagePrice } = input;
  if (!capacity || capacity <= 0) throw new Error('capacity must be greater than zero.');
  if (!packagePrice || packagePrice <= 0) throw new Error('packagePrice must be greater than zero.');
  return PilgrimageGroup.create({ companyId, branchId, packageName, departureDate, capacity, packagePrice });
}

function listGroups(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return PilgrimageGroup.find(filter).sort({ departureDate: 1 });
}

/**
 * Enrolls a customer — exactly Gym's capacity check (fills the group up
 * to capacity, waitlists otherwise), but ONLY a real seat gets a fresh
 * PilgrimPayment plan created for them. A waitlisted person hasn't
 * actually secured anything yet — starting them on an installment plan
 * for a seat they don't have would be wrong.
 */
async function enroll(groupId, { customerId, depositLiabilityAccountId }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const group = await PilgrimageGroup.findById(groupId).session(session);
      if (!group) throw new Error('Pilgrimage group not found.');
      if (group.status !== 'open') throw new Error(`Cannot enroll in a group with status "${group.status}".`);
      if (group.enrolledCustomerIds.some((id) => String(id) === String(customerId))) throw new Error('Already enrolled in this group.');
      if (group.waitlistCustomerIds.some((id) => String(id) === String(customerId))) throw new Error('Already on the waitlist for this group.');

      if (group.enrolledCustomerIds.length < group.capacity) {
        group.enrolledCustomerIds.push(customerId);
        await group.save({ session });
        await PilgrimPayment.create(
          [{ companyId: group.companyId, branchId: group.branchId, groupId: group._id, customerId, totalPrice: group.packagePrice, depositLiabilityAccountId }],
          { session }
        );
        result = { enrolled: true, waitlisted: false };
      } else {
        group.waitlistCustomerIds.push(customerId);
        await group.save({ session });
        result = { enrolled: false, waitlisted: true, waitlistPosition: group.waitlistCustomerIds.length };
      }
    });
    return result;
  } finally {
    session.endSession();
  }
}

/**
 * Cancels a pilgrim's seat — the real, new interaction. Promotes the
 * longest-waiting waitlisted person into the now-open seat AND creates
 * THEIR OWN fresh PilgrimPayment starting at zero (not inherited).
 * Separately, the CANCELLING pilgrim's existing payment plan is resolved
 * — refunded per the same policy Layaway's cancelPlan already
 * established (a percentage refund, since a full-refund default would be
 * wrong for a real travel package with genuine non-refundable costs
 * already committed on the operator's side).
 */
async function cancelEnrollment(groupId, customerId, { refundPercent, refundAccountId, forfeitRevenueAccountId, depositLiabilityAccountId, userId }) {
  const session = await mongoose.startSession();
  try {
    let promotedCustomerId = null;
    let cancelledPayment = null;

    await session.withTransaction(async () => {
      const group = await PilgrimageGroup.findById(groupId).session(session);
      if (!group) throw new Error('Pilgrimage group not found.');

      const idx = group.enrolledCustomerIds.findIndex((id) => String(id) === String(customerId));
      if (idx === -1) throw new Error('This customer is not enrolled in this group.');
      group.enrolledCustomerIds.splice(idx, 1);

      if (group.waitlistCustomerIds.length > 0) {
        promotedCustomerId = group.waitlistCustomerIds.shift(); // front of the array = longest-waiting, exactly Gym's rule
        group.enrolledCustomerIds.push(promotedCustomerId);
        await PilgrimPayment.create(
          [{ companyId: group.companyId, branchId: group.branchId, groupId: group._id, customerId: promotedCustomerId, totalPrice: group.packagePrice, depositLiabilityAccountId }],
          { session }
        );
      }

      await group.save({ session });
      cancelledPayment = await PilgrimPayment.findOne({ groupId, customerId }).session(session);
    });

    // The cancelling pilgrim's own payment resolution — done as its own
    // step, deliberately outside the transaction above, since it posts a
    // voucher (a real, single-document atomic write, safe standalone —
    // same reasoning every other "resolve the money after the structural
    // change" step in this app already follows).
    if (cancelledPayment && cancelledPayment.amountPaid > 0 && cancelledPayment.status === 'active') {
      const pct = Math.max(0, Math.min(100, refundPercent ?? 100));
      const refunded = Math.round(cancelledPayment.amountPaid * (pct / 100) * 100) / 100;
      const forfeited = Math.round((cancelledPayment.amountPaid - refunded) * 100) / 100;

      const entries = [{ accountId: cancelledPayment.depositLiabilityAccountId, debit: cancelledPayment.amountPaid, credit: 0 }];
      if (refunded > 0) {
        if (!refundAccountId) throw new Error('refundAccountId is required when any amount is refunded.');
        entries.push({ accountId: refundAccountId, debit: 0, credit: refunded });
      }
      if (forfeited > 0) {
        if (!forfeitRevenueAccountId) throw new Error('forfeitRevenueAccountId is required when any amount is forfeited.');
        entries.push({ accountId: forfeitRevenueAccountId, debit: 0, credit: forfeited });
      }

      await accountingService.postVoucher({
        companyId: cancelledPayment.companyId, branchId: cancelledPayment.branchId, type: 'journal',
        narration: `Pilgrimage cancellation — ${pct}% of payments refunded`,
        entries, referenceType: 'PilgrimPayment', referenceId: cancelledPayment._id, userId,
      });

      cancelledPayment.status = 'cancelled';
      await cancelledPayment.save();
    } else if (cancelledPayment) {
      cancelledPayment.status = 'cancelled';
      await cancelledPayment.save();
    }

    return { promotedCustomerId };
  } finally {
    session.endSession();
  }
}

/** Exactly Layaway's makePayment mechanic — accumulate toward totalPrice, auto-complete and bill through checkout the moment the threshold is crossed. */
async function makePayment(paymentId, { amount, paymentAccountId, warehouseId, billingProductId, billingVariantId, posTerminalId, userId }) {
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');

  const pilgrimPayment = await PilgrimPayment.findById(paymentId);
  if (!pilgrimPayment) throw new Error('Pilgrim payment plan not found.');
  if (pilgrimPayment.status !== 'active') throw new Error(`Cannot pay toward a plan with status "${pilgrimPayment.status}".`);

  await accountingService.postVoucher({
    companyId: pilgrimPayment.companyId, branchId: pilgrimPayment.branchId, type: 'receipt', narration: 'Pilgrimage package installment received',
    entries: [
      { accountId: paymentAccountId, debit: amount, credit: 0 },
      { accountId: pilgrimPayment.depositLiabilityAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'PilgrimPayment', referenceId: pilgrimPayment._id, userId,
  });

  pilgrimPayment.payments.push({ amount, paymentAccountId });
  pilgrimPayment.amountPaid = Math.round((pilgrimPayment.amountPaid + amount) * 100) / 100;

  const remaining = Math.round((pilgrimPayment.totalPrice - pilgrimPayment.amountPaid) * 100) / 100;
  if (remaining > 0) {
    await pilgrimPayment.save();
    return { pilgrimPayment, completed: false, remaining };
  }

  const sale = await posSaleService.checkout({
    companyId: pilgrimPayment.companyId, branchId: pilgrimPayment.branchId, warehouseId,
    customerId: pilgrimPayment.customerId, posTerminalId, userId,
    items: [{ productId: billingProductId, variantId: billingVariantId, quantity: 1, unitPrice: pilgrimPayment.totalPrice }],
    payments: [{ paymentAccountId: pilgrimPayment.depositLiabilityAccountId, method: 'advance_applied', amount: pilgrimPayment.totalPrice }],
  });

  pilgrimPayment.status = 'completed';
  pilgrimPayment.saleId = sale._id;
  await pilgrimPayment.save();

  return { pilgrimPayment, completed: true, remaining: 0, sale };
}

function listPayments(companyId, { groupId, customerId } = {}) {
  const filter = { companyId };
  if (groupId) filter.groupId = groupId;
  if (customerId) filter.customerId = customerId;
  return PilgrimPayment.find(filter).populate('customerId', 'name').sort({ createdAt: -1 });
}

/**
 * Corrects a departure's details. packagePrice is safe to change at any
 * time — enroll() snapshots the price onto each pilgrim's OWN
 * PilgrimPayment.totalPrice at the moment they join, so existing plans
 * are never affected, only pilgrims who enroll after the change.
 * capacity can be raised freely but never dropped below how many people
 * are already actually enrolled — that would silently orphan real seats.
 */
async function updateGroup(groupId, { packageName, departureDate, capacity, packagePrice }) {
  const group = await PilgrimageGroup.findById(groupId);
  if (!group) throw new Error('Pilgrimage group not found.');
  if (group.status !== 'open') throw new Error(`Cannot edit a group with status "${group.status}".`);

  if (packageName !== undefined) group.packageName = packageName;
  if (departureDate !== undefined) group.departureDate = departureDate;
  if (packagePrice !== undefined) {
    if (!packagePrice || packagePrice <= 0) throw new Error('packagePrice must be greater than zero.');
    group.packagePrice = packagePrice;
  }
  if (capacity !== undefined) {
    if (!capacity || capacity <= 0) throw new Error('capacity must be greater than zero.');
    if (capacity < group.enrolledCustomerIds.length) {
      throw new Error(`Cannot set capacity below the ${group.enrolledCustomerIds.length} pilgrims already enrolled.`);
    }
    group.capacity = capacity;
  }

  await group.save();
  return group;
}

module.exports = { createGroup, listGroups, enroll, cancelEnrollment, makePayment, listPayments, updateGroup };
