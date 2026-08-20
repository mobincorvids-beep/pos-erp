/**
 * BuybackService — old gold intake for trade-in credit. Deliberately does
 * NOT touch checkout or post any accounting itself; it just quotes and
 * tracks a credit amount. The credit gets applied as a per-line discount
 * on the next checkout (client-side, same as loyalty redemption), and
 * markApplied() links this record to the resulting Sale afterward purely
 * for audit trail — "which buyback paid for how much of this invoice."
 */
const BuybackTransaction = require('../models/BuybackTransaction');
const jewelryPricingService = require('./jewelryPricingService');

async function intake({ companyId, customerId, karat, weightGrams, deductionPercent, userId }) {
  if (!weightGrams || weightGrams <= 0) throw new Error('weightGrams must be greater than zero.');

  const rate = await jewelryPricingService.getCurrentRate(companyId, karat);
  const effectiveWeight = weightGrams * (1 - (deductionPercent || 0) / 100);
  const creditAmount = Math.round(effectiveWeight * rate.ratePerGram * 100) / 100;

  return BuybackTransaction.create({
    companyId, customerId, karat, weightGrams, deductionPercent: deductionPercent || 0,
    ratePerGram: rate.ratePerGram, creditAmount, userId,
  });
}

async function markApplied(buybackId, saleId) {
  const buyback = await BuybackTransaction.findById(buybackId);
  if (!buyback) throw new Error('Buyback transaction not found.');
  if (buyback.status !== 'pending') throw new Error(`Cannot apply a buyback with status "${buyback.status}".`);

  buyback.status = 'applied';
  buyback.saleId = saleId;
  await buyback.save();
  return buyback;
}

async function cancel(buybackId) {
  const buyback = await BuybackTransaction.findById(buybackId);
  if (!buyback) throw new Error('Buyback transaction not found.');
  if (buyback.status !== 'pending') throw new Error(`Cannot cancel a buyback with status "${buyback.status}".`);

  buyback.status = 'cancelled';
  await buyback.save();
  return buyback;
}

function listForCustomer(companyId, customerId) {
  return BuybackTransaction.find({ companyId, customerId }).sort({ createdAt: -1 });
}

module.exports = { intake, markApplied, cancel, listForCustomer };
