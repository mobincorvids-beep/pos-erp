/**
 * GoldSavingsService — see GoldSavingsScheme.js for the trade concept.
 * Three real actions: enroll (commit, no money yet), recordInstallment
 * (real cash received, posted to the liability account — repeated monthly),
 * and redeem (the accumulated liability is cleared through an actual sale,
 * same advance-applied-as-a-payment-leg pattern Banquet's completeEvent
 * already established for a single deposit).
 */
const mongoose = require('mongoose');
const GoldSavingsScheme = require('../models/GoldSavingsScheme');
const jewelryPricingService = require('./jewelryPricingService');
const accountingService = require('../../../services/accountingService');
const posSaleService = require('../../../services/posSaleService');

function enroll(input) {
  const { companyId, branchId, customerId, targetKarat, monthlyAmount, totalMonths, startDate, liabilityAccountId, userId } = input;
  if (!targetKarat) throw new Error('targetKarat is required.');
  if (!monthlyAmount || monthlyAmount <= 0) throw new Error('monthlyAmount must be greater than zero.');
  if (!totalMonths || totalMonths <= 0) throw new Error('totalMonths must be greater than zero.');
  if (!liabilityAccountId) throw new Error('liabilityAccountId is required.');
  return GoldSavingsScheme.create({
    companyId, branchId, customerId, targetKarat, monthlyAmount, totalMonths,
    startDate: startDate || new Date(), liabilityAccountId, userId,
  });
}

function listSchemes(companyId, { customerId, status } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  return GoldSavingsScheme.find(filter).populate('customerId', 'name').sort({ createdAt: -1 });
}

/**
 * Records one real monthly payment. Posts a receipt voucher (debit the
 * account the cash actually landed in, credit the scheme's fixed
 * liability account) exactly like Banquet's deposit intake — the only
 * difference is this runs once a month, repeatedly, for the same scheme,
 * instead of once at booking.
 */
async function recordInstallment(schemeId, { amount, receivedInAccountId, userId }) {
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');
  if (!receivedInAccountId) throw new Error('receivedInAccountId is required.');

  const session = await mongoose.startSession();
  try {
    let scheme;
    await session.withTransaction(async () => {
      scheme = await GoldSavingsScheme.findById(schemeId).session(session);
      if (!scheme) throw new Error('Scheme not found.');
      if (scheme.status !== 'active') throw new Error(`Cannot record a payment against a scheme with status "${scheme.status}".`);

      await accountingService.postVoucher({
        companyId: scheme.companyId, branchId: scheme.branchId, type: 'receipt',
        narration: `Gold savings installment — scheme ${scheme._id}`,
        entries: [
          { accountId: receivedInAccountId, debit: amount, credit: 0 },
          { accountId: scheme.liabilityAccountId, debit: 0, credit: amount },
        ],
        referenceType: 'GoldSavingsScheme', referenceId: scheme._id, userId,
      }, session);

      scheme.installments.push({ amount, receivedInAccountId, paidAt: new Date() });
      scheme.totalPaid += amount;
      if (scheme.totalPaid >= scheme.monthlyAmount * scheme.totalMonths) scheme.status = 'matured';
      await scheme.save({ session });
    });
    return scheme;
  } finally {
    session.endSession();
  }
}

async function cancel(schemeId) {
  const scheme = await GoldSavingsScheme.findById(schemeId);
  if (!scheme) throw new Error('Scheme not found.');
  if (!['active', 'matured'].includes(scheme.status)) throw new Error(`Cannot cancel a scheme with status "${scheme.status}".`);
  // Deliberately doesn't auto-refund — a scheme carrying real money means
  // staff should decide and record a refund themselves (ordinary Expense
  // or Banking entry against the liability account), the same way Hotel
  // and Banquet leave a plain cancellation's deposit handling to a
  // separate explicit step rather than guessing refund-vs-forfeit terms.
  scheme.status = 'cancelled';
  return scheme.save();
}

/**
 * Redeems the accumulated balance toward an actual sale. The customer
 * picks a real jewelry item (or several) at checkout as normal; this
 * supplies one more payment leg on that same checkout call, sourced from
 * the scheme's liability account instead of cash — clearing the
 * liability and finalizing the sale in one voucher, exactly how Banquet's
 * completeEvent applies its deposit. If the item costs more than
 * totalPaid, the rest of checkout's `payments` array covers the
 * difference like any ordinary mixed-tender sale; if it costs less,
 * checkout's own over-payment handling applies (same as it would for a
 * cash overpayment).
 */
async function redeem(schemeId, { items, additionalPayments, branchId, warehouseId, customerId, posTerminalId, userId }) {
  const scheme = await GoldSavingsScheme.findById(schemeId);
  if (!scheme) throw new Error('Scheme not found.');
  if (!['active', 'matured'].includes(scheme.status)) throw new Error(`Cannot redeem a scheme with status "${scheme.status}".`);
  if (scheme.totalPaid <= 0) throw new Error('Nothing has been paid into this scheme yet.');
  if (!items?.length) throw new Error('At least one item is required to redeem against.');

  const rate = await jewelryPricingService.getCurrentRate(scheme.companyId, scheme.targetKarat);
  const redeemedWeightGrams = Math.round((scheme.totalPaid / rate.ratePerGram) * 1000) / 1000;

  const payments = [
    { paymentAccountId: scheme.liabilityAccountId, method: 'gold_savings_applied', amount: scheme.totalPaid },
    ...(additionalPayments || []),
  ];

  const sale = await posSaleService.checkout({
    companyId: scheme.companyId, branchId: branchId || scheme.branchId, warehouseId,
    customerId: customerId || scheme.customerId, posTerminalId, userId,
    items, payments,
  });

  scheme.status = 'redeemed';
  scheme.redeemedAt = new Date();
  scheme.redeemedSaleId = sale._id;
  scheme.redeemedWeightGrams = redeemedWeightGrams;
  await scheme.save();

  return { scheme, sale, redeemedWeightGrams, ratePerGramUsed: rate.ratePerGram };
}

module.exports = { enroll, listSchemes, recordInstallment, cancel, redeem };
