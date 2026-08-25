/**
 * LayawayService — open-ended partial-payment holds. The genuinely new
 * mechanic: makePayment() is called an unknown number of times over an
 * unknown period, and the moment the running total crosses totalPrice —
 * on WHICHEVER payment does it, not a scheduled final one — the plan
 * completes automatically in the same call: the item is released from
 * reservation and actually deducted from stock, and the accumulated
 * liability is converted into real revenue through the ordinary checkout.
 * No separate "finish the layaway" action exists, because there's nothing
 * for staff to decide — crossing the threshold IS completion.
 */
const mongoose = require('mongoose');
const LayawayPlan = require('../models/LayawayPlan');
const inventoryService = require('../../../services/inventoryService');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

/** Opens a plan and reserves the item — held, not deducted, since nothing has been sold yet and might never be (see cancelPlan). */
async function createPlan(input) {
  const { companyId, branchId, warehouseId, productId, variantId, quantity, customerId, totalPrice, depositLiabilityAccountId, userId } = input;
  if (!totalPrice || totalPrice <= 0) throw new Error('totalPrice must be greater than zero.');

  const session = await mongoose.startSession();
  try {
    let plan;
    await session.withTransaction(async () => {
      await inventoryService.assertSufficientStock(warehouseId, variantId, null, quantity || 1);
      await inventoryService.reserve(warehouseId, variantId, null, quantity || 1, session);

      [plan] = await LayawayPlan.create(
        [{ companyId, branchId, warehouseId, productId, variantId, quantity: quantity || 1, customerId, totalPrice, depositLiabilityAccountId }],
        { session }
      );
    });
    return plan;
  } finally {
    session.endSession();
  }
}

function listPlans(companyId, { status, customerId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  return LayawayPlan.find(filter).populate('customerId', 'name').populate('productId', 'name').sort({ createdAt: -1 });
}

/**
 * Records one payment and checks the running total. If it now covers
 * totalPrice, completes the plan in the SAME call: releases the
 * reservation, deducts real stock, converts the accumulated liability
 * into revenue through the ordinary checkout (the liability account is
 * passed as the checkout "payment" account — the exact same trick Hotel's
 * check-out and Furniture's delivery already use to clear a deposit
 * liability via nothing but core checkout's ordinary voucher logic).
 */
async function makePayment(planId, { amount, paymentAccountId, posTerminalId, userId }) {
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');

  const plan = await LayawayPlan.findById(planId);
  if (!plan) throw new Error('Layaway plan not found.');
  if (plan.status !== 'active') throw new Error(`Cannot pay toward a plan with status "${plan.status}".`);

  // The cash receipt itself is a genuine, real, single-document atomic
  // write — always safe standalone, same reasoning Hardware's returnRental
  // uses for its own voucher/movement steps once checkout() is involved.
  await accountingService.postVoucher({
    companyId: plan.companyId, branchId: plan.branchId, type: 'receipt', narration: 'Layaway payment received',
    entries: [
      { accountId: paymentAccountId, debit: amount, credit: 0 },
      { accountId: plan.depositLiabilityAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'LayawayPlan', referenceId: plan._id, userId,
  });

  plan.payments.push({ amount, paymentAccountId });
  plan.amountPaid = Math.round((plan.amountPaid + amount) * 100) / 100;

  const remaining = Math.round((plan.totalPrice - plan.amountPaid) * 100) / 100;
  if (remaining > 0) {
    await plan.save();
    return { plan, completed: false, remaining };
  }

  // --- Threshold crossed on THIS payment — complete automatically ---
  await inventoryService.releaseReservation(plan.warehouseId, plan.variantId, null, plan.quantity);

  const sale = await posSaleService.checkout({
    companyId: plan.companyId, branchId: plan.branchId, warehouseId: plan.warehouseId,
    customerId: plan.customerId, posTerminalId, userId,
    items: [{ productId: plan.productId, variantId: plan.variantId, quantity: plan.quantity, unitPrice: plan.totalPrice / plan.quantity }],
    payments: [{ paymentAccountId: plan.depositLiabilityAccountId, method: 'advance_applied', amount: plan.totalPrice }],
  });

  plan.status = 'completed';
  plan.saleId = sale._id;
  await plan.save();

  return { plan, completed: true, remaining: 0, sale };
}

/** Cancels an unfinished plan — releases the reservation, refunds whatever fraction of the paid-in amount the policy allows (a restocking fee is common in real layaway, so this isn't assumed to be 100%). */
async function cancelPlan(planId, { refundPercent, refundAccountId, forfeitRevenueAccountId, userId }) {
  const plan = await LayawayPlan.findById(planId);
  if (!plan) throw new Error('Layaway plan not found.');
  if (plan.status !== 'active') throw new Error(`Cannot cancel a plan with status "${plan.status}".`);

  await inventoryService.releaseReservation(plan.warehouseId, plan.variantId, null, plan.quantity);

  if (plan.amountPaid > 0) {
    const pct = Math.max(0, Math.min(100, refundPercent ?? 100));
    const refunded = Math.round(plan.amountPaid * (pct / 100) * 100) / 100;
    const forfeited = Math.round((plan.amountPaid - refunded) * 100) / 100;

    const entries = [{ accountId: plan.depositLiabilityAccountId, debit: plan.amountPaid, credit: 0 }];
    if (refunded > 0) {
      if (!refundAccountId) throw new Error('refundAccountId is required when any amount is refunded.');
      entries.push({ accountId: refundAccountId, debit: 0, credit: refunded });
    }
    if (forfeited > 0) {
      if (!forfeitRevenueAccountId) throw new Error('forfeitRevenueAccountId is required when any amount is forfeited (a restocking fee).');
      entries.push({ accountId: forfeitRevenueAccountId, debit: 0, credit: forfeited });
    }

    await accountingService.postVoucher({
      companyId: plan.companyId, branchId: plan.branchId, type: 'journal',
      narration: `Layaway plan cancelled — ${pct}% of payments refunded`,
      entries, referenceType: 'LayawayPlan', referenceId: plan._id, userId,
    });
  }

  plan.status = 'cancelled';
  await plan.save();
  return plan;
}

/**
 * Corrects a plan's terms before any money has actually been paid toward
 * it — a mistyped price at open time, or the customer changing their mind
 * on quantity, is common; once even one payment has been recorded, the
 * plan's math (amountPaid tracked against totalPrice, completion
 * triggered by crossing it) depends on that price being stable, so this
 * is deliberately locked out the moment amountPaid > 0. Quantity changes
 * re-check and adjust the stock reservation to match, the same
 * reserve/release pair createPlan/cancelPlan already use.
 */
async function updatePlan(planId, { totalPrice, quantity, customerId }) {
  const plan = await LayawayPlan.findById(planId);
  if (!plan) throw new Error('Layaway plan not found.');
  if (plan.status !== 'active') throw new Error(`Cannot edit a plan with status "${plan.status}".`);
  if (plan.amountPaid > 0) throw new Error('Cannot edit terms after a payment has already been made toward this plan — cancel and reopen instead if the terms genuinely need to change.');

  if (quantity !== undefined && quantity !== plan.quantity) {
    if (!quantity || quantity <= 0) throw new Error('quantity must be greater than zero.');
    const delta = quantity - plan.quantity;
    if (delta > 0) {
      await inventoryService.assertSufficientStock(plan.warehouseId, plan.variantId, null, delta);
      await inventoryService.reserve(plan.warehouseId, plan.variantId, null, delta);
    } else if (delta < 0) {
      await inventoryService.releaseReservation(plan.warehouseId, plan.variantId, null, -delta);
    }
    plan.quantity = quantity;
  }
  if (totalPrice !== undefined) {
    if (!totalPrice || totalPrice <= 0) throw new Error('totalPrice must be greater than zero.');
    plan.totalPrice = totalPrice;
  }
  if (customerId !== undefined) plan.customerId = customerId;

  await plan.save();
  return plan;
}

module.exports = { createPlan, listPlans, makePayment, cancelPlan, updatePlan };
