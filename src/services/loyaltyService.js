/**
 * LoyaltyService — points earn/redeem. Earning is a post-checkout side
 * effect (like FbrService: never blocks or rolls back a sale). Redemption
 * is pre-checkout: it converts points into a currency value the caller
 * passes into PosSaleService as a discount, so redemption still goes
 * through the normal checkout accounting rather than becoming its own
 * parallel payment method with separate ledger logic.
 */
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const LoyaltyProgram = require('../models/LoyaltyProgram');
const LoyaltyTransaction = require('../models/LoyaltyTransaction');

async function getProgram(companyId) {
  return LoyaltyProgram.findOne({ companyId, isActive: true });
}

/** Awards points for a completed sale. Called after checkout succeeds, see saleController. */
async function earnPointsForSale(sale) {
  const program = await getProgram(sale.companyId);
  if (!program || !sale.customerId) return null;

  const earnableAmount = sale.subtotal - sale.discountAmount; // net of discount, before tax
  const points = Math.floor(earnableAmount / program.earnRate);
  if (points <= 0) return null;

  const session = await mongoose.startSession();
  try {
    let txn;
    await session.withTransaction(async () => {
      await Customer.findByIdAndUpdate(sale.customerId, { $inc: { loyaltyPoints: points } }, { session });
      [txn] = await LoyaltyTransaction.create(
        [{ companyId: sale.companyId, customerId: sale.customerId, type: 'earn', points, saleId: sale._id, note: `Earned on sale ${sale.invoiceNumber}` }],
        { session }
      );
    });
    return txn;
  } finally {
    session.endSession();
  }
}

/**
 * Converts a requested points amount into a currency discount value, and
 * deducts the points immediately (reserved against this checkout). If the
 * checkout that follows fails, call reverseRedemption() to refund the points.
 *
 * @returns {{ points: Number, discountValue: Number }}
 */
async function redeemPoints(customerId, requestedPoints, userId) {
  const program = await getProgram((await Customer.findById(customerId))?.companyId);
  if (!program) throw new Error('No active loyalty program for this company.');
  if (requestedPoints < program.minRedeemPoints) {
    throw new Error(`Minimum redemption is ${program.minRedeemPoints} points.`);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const customer = await Customer.findById(customerId).session(session);
      if (!customer) throw new Error('Customer not found.');
      if (customer.loyaltyPoints < requestedPoints) {
        throw new Error(`Insufficient points: has ${customer.loyaltyPoints}, requested ${requestedPoints}.`);
      }

      customer.loyaltyPoints -= requestedPoints;
      await customer.save({ session });

      await LoyaltyTransaction.create(
        [{ companyId: customer.companyId, customerId, type: 'redeem', points: -requestedPoints, note: 'Redeemed at checkout', userId }],
        { session }
      );

      result = { points: requestedPoints, discountValue: Math.round(requestedPoints * program.redemptionValue * 100) / 100 };
    });
    return result;
  } finally {
    session.endSession();
  }
}

/** Refunds points if a redemption was reserved but the checkout it was for didn't complete. */
async function reverseRedemption(customerId, points, userId) {
  const customer = await Customer.findByIdAndUpdate(customerId, { $inc: { loyaltyPoints: points } }, { new: true });
  if (!customer) throw new Error('Customer not found.');
  await LoyaltyTransaction.create({
    companyId: customer.companyId, customerId, type: 'adjustment', points,
    note: 'Reversed unused redemption', userId,
  });
  return customer;
}

async function history(customerId) {
  return LoyaltyTransaction.find({ customerId }).sort({ createdAt: -1 }).limit(200);
}

module.exports = { getProgram, earnPointsForSale, redeemPoints, reverseRedemption, history };
