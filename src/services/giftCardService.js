/**
 * GiftCardService — issue a stored-value card, look it up at POS to show
 * its balance before charging it, and redeem some or all of its balance
 * as one payment on a Sale. All balance math is done server-side and
 * clamped so a card can never go negative, the same "never trust the
 * client, never let a balance cross zero" rule EmployeeLoanService
 * already applies to remainingBalance.
 */
const crypto = require('crypto');
const GiftCard = require('../models/GiftCard');
const GiftCardTransaction = require('../models/GiftCardTransaction');

const CARD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I — avoids misread digits when read aloud/typed at a register

function generateCardNumber(length = 16) {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += CARD_CHARS[crypto.randomInt(CARD_CHARS.length)];
  }
  return out;
}

async function issueGiftCard({ companyId, initialBalance, customerId, expiresAt, userId }) {
  if (!initialBalance || initialBalance <= 0) throw new Error('initialBalance must be greater than zero.');

  // Practically unreachable with a 16-char, 33-symbol alphabet, but this
  // codebase never assumes a random ID collision can't happen (see
  // numberingService/serialInventoryService) — regenerate rather than fail.
  let cardNumber;
  for (let attempt = 0; attempt < 5; attempt++) {
    cardNumber = generateCardNumber();
    const clash = await GiftCard.findOne({ companyId, cardNumber });
    if (!clash) break;
    if (attempt === 4) throw new Error('Could not generate a unique gift card number — try again.');
  }

  const card = await GiftCard.create({
    companyId, cardNumber, initialBalance, currentBalance: initialBalance,
    issuedToCustomerId: customerId || null, expiresAt: expiresAt || null, issuedByUserId: userId,
  });

  await GiftCardTransaction.create({
    companyId, giftCardId: card._id, type: 'issue', amount: initialBalance, balanceAfter: initialBalance, userId,
  });

  return card;
}

function isUsable(card) {
  if (!card) return { usable: false, reason: 'Gift card not found.' };
  if (card.status === 'cancelled') return { usable: false, reason: 'This gift card has been cancelled.' };
  if (card.status === 'expired' || (card.expiresAt && card.expiresAt < new Date())) return { usable: false, reason: 'This gift card has expired.' };
  if (card.status === 'redeemed' || card.currentBalance <= 0) return { usable: false, reason: 'This gift card has no remaining balance.' };
  return { usable: true, reason: null };
}

async function lookupGiftCard(companyId, cardNumber) {
  const card = await GiftCard.findOne({ companyId, cardNumber: String(cardNumber || '').toUpperCase().trim() });
  const { usable, reason } = isUsable(card);
  return { card, balance: card ? card.currentBalance : 0, usable, reason };
}

async function redeemGiftCard(companyId, cardNumber, amount, { saleId, userId } = {}) {
  if (!amount || amount <= 0) throw new Error('Redemption amount must be greater than zero.');

  const card = await GiftCard.findOne({ companyId, cardNumber: String(cardNumber || '').toUpperCase().trim() });
  const { usable, reason } = isUsable(card);
  if (!usable) throw new Error(reason);

  if (amount > card.currentBalance + 0.01) {
    throw new Error(`Redemption of ${amount} exceeds the remaining balance of ${card.currentBalance}.`);
  }

  card.currentBalance = Math.round((card.currentBalance - amount) * 100) / 100;
  if (card.currentBalance <= 0.01) { card.currentBalance = 0; card.status = 'redeemed'; }
  await card.save();

  await GiftCardTransaction.create({
    companyId, giftCardId: card._id, type: 'redeem', amount: -amount, balanceAfter: card.currentBalance,
    saleId: saleId || null, userId: userId || null,
  });

  return card;
}

function listGiftCards(companyId, { status, customerId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (customerId) filter.issuedToCustomerId = customerId;
  return GiftCard.find(filter).populate('issuedToCustomerId', 'name').sort({ createdAt: -1 });
}

function listTransactions(companyId, giftCardId) {
  return GiftCardTransaction.find({ companyId, giftCardId }).sort({ createdAt: -1 });
}

module.exports = { issueGiftCard, lookupGiftCard, redeemGiftCard, listGiftCards, listTransactions, generateCardNumber };
