/**
 * TelecomService — subscribeCustomer() reuses Cafe's subscription-sale
 * shape (bill through checkout, hold a recurring plan). The genuinely
 * new mechanic is generateMonthlyBill(): usage accumulates all period
 * against a quota via recordUsage() — pure bookkeeping, no money moves
 * yet — and only at bill time does the actual overage get computed and
 * charged, on exactly the excess over the included quota, never the
 * whole usage amount. Two separate, honestly-labeled line items on the
 * resulting Sale: the flat plan fee, and the overage (only if there is any).
 */
const TelecomPlan = require('../models/TelecomPlan');
const CustomerSubscription = require('../models/CustomerSubscription');
const posSaleService = require('../../../services/posSaleService');

function createPlan(input) {
  const { companyId, name, monthlyFee, includedMinutes, includedDataMB, includedSms, overageRatePerMinute, overageRatePerMB, overageRatePerSms, billingProductId, billingVariantId, overageBillingProductId, overageBillingVariantId } = input;
  if (!monthlyFee || monthlyFee <= 0) throw new Error('monthlyFee must be greater than zero.');
  return TelecomPlan.create({ companyId, name, monthlyFee, includedMinutes, includedDataMB, includedSms, overageRatePerMinute, overageRatePerMB, overageRatePerSms, billingProductId, billingVariantId, overageBillingProductId, overageBillingVariantId });
}

function listPlans(companyId) {
  return TelecomPlan.find({ companyId });
}

async function subscribeCustomer(input) {
  const { companyId, branchId, customerId, planId, warehouseId, paymentAccountId, posTerminalId, userId } = input;
  const plan = await TelecomPlan.findById(planId);
  if (!plan) throw new Error('Plan not found.');

  await posSaleService.checkout({
    companyId, branchId, warehouseId, customerId, posTerminalId, userId,
    items: [{ productId: plan.billingProductId, variantId: plan.billingVariantId, quantity: 1, unitPrice: plan.monthlyFee }],
    payments: [{ paymentAccountId, method: 'cash', amount: plan.monthlyFee }],
  });

  return CustomerSubscription.create({ companyId, branchId, customerId, planId, currentPeriodStart: new Date() });
}

function listSubscriptions(companyId, { customerId, status } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  return CustomerSubscription.find(filter).populate('customerId', 'name').populate('planId', 'name');
}

/** Pure bookkeeping — accumulates usage against the current period's running totals. No money involved here at all; that only happens at bill time. */
async function recordUsage(subscriptionId, { minutes, dataMB, sms }) {
  const subscription = await CustomerSubscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found.');
  if (subscription.status !== 'active') throw new Error(`Cannot record usage against a subscription with status "${subscription.status}".`);

  subscription.usedMinutes += minutes || 0;
  subscription.usedDataMB += dataMB || 0;
  subscription.usedSms += sms || 0;
  await subscription.save();
  return subscription;
}

/**
 * Computes and bills exactly one period: the flat plan fee, always; the
 * overage — computed independently per metric (minutes, data, SMS), each
 * as max(0, used - included) × that metric's own rate, summed — only if
 * there's any. Resets usage to 0 and advances currentPeriodStart to now,
 * the same "the meter rolls over" reset School's period-invoice
 * generation and Cafe's daily cap both already established, just at a
 * monthly grain instead of daily.
 */
async function generateMonthlyBill(subscriptionId, { warehouseId, paymentAccountId, posTerminalId, userId }) {
  const subscription = await CustomerSubscription.findById(subscriptionId);
  if (!subscription) throw new Error('Subscription not found.');
  const plan = await TelecomPlan.findById(subscription.planId);
  if (!plan) throw new Error('Plan not found.');

  const overageMinutes = Math.max(0, subscription.usedMinutes - plan.includedMinutes);
  const overageDataMB = Math.max(0, subscription.usedDataMB - plan.includedDataMB);
  const overageSms = Math.max(0, subscription.usedSms - plan.includedSms);
  const overageCost = Math.round((overageMinutes * plan.overageRatePerMinute + overageDataMB * plan.overageRatePerMB + overageSms * plan.overageRatePerSms) * 100) / 100;

  const items = [{ productId: plan.billingProductId, variantId: plan.billingVariantId, quantity: 1, unitPrice: plan.monthlyFee }];
  const payments = [{ paymentAccountId, method: 'cash', amount: plan.monthlyFee }];
  if (overageCost > 0) {
    items.push({ productId: plan.overageBillingProductId, variantId: plan.overageBillingVariantId, quantity: 1, unitPrice: overageCost });
    payments[0].amount += overageCost;
  }

  const sale = await posSaleService.checkout({
    companyId: subscription.companyId, branchId: subscription.branchId, warehouseId, customerId: subscription.customerId, posTerminalId, userId,
    items, payments,
  });

  const usageSummary = { overageMinutes, overageDataMB, overageSms, overageCost, totalBilled: plan.monthlyFee + overageCost };

  subscription.usedMinutes = 0;
  subscription.usedDataMB = 0;
  subscription.usedSms = 0;
  subscription.currentPeriodStart = new Date();
  await subscription.save();

  return { sale, usageSummary };
}

module.exports = { createPlan, listPlans, subscribeCustomer, listSubscriptions, recordUsage, generateMonthlyBill };
