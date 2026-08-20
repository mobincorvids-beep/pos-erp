const LoyaltyProgram = require('../models/LoyaltyProgram');
const loyaltyService = require('../services/loyaltyService');

async function getProgram(req, res) {
  const program = await LoyaltyProgram.findOne({ companyId: req.companyId });
  res.json(program || null);
}

async function upsertProgram(req, res) {
  try {
    const program = await LoyaltyProgram.findOneAndUpdate(
      { companyId: req.companyId },
      { ...req.body, companyId: req.companyId },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(program);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/**
 * Quotes (and reserves) a points redemption ahead of checkout. The returned
 * `discountValue` must be distributed by the caller across one or more
 * `items[].discountAmount` in the subsequent POST /sales/checkout call —
 * Sale has no header-level discount field, only per-line, so redemption
 * doesn't get its own special-cased payment method. If checkout fails after
 * this call, use POST /loyalty/customers/:id/reverse to refund the points.
 */
async function redeem(req, res) {
  try {
    const result = await loyaltyService.redeemPoints(req.params.customerId, req.body.points, req.auth.userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reverseRedemption(req, res) {
  try {
    const customer = await loyaltyService.reverseRedemption(req.params.customerId, req.body.points, req.auth.userId);
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function history(req, res) {
  const rows = await loyaltyService.history(req.params.customerId);
  res.json(rows);
}

module.exports = { getProgram, upsertProgram, redeem, reverseRedemption, history };
