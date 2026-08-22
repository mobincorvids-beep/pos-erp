/**
 * FundService — the genuinely new mechanic: a disbursement is checked
 * against a FUND's own balance, not the organization's real cash. The
 * balance check and the deduction happen in ONE atomic MongoDB operation
 * (the same `findOneAndUpdate` with a conditional filter pattern Gift
 * Registry's `reserveRegistryQuantity` already established), because two
 * concurrent disbursements against the same fund are exactly the same
 * race-condition risk as two concurrent purchases against a shared gift
 * registry quota — a naive read-then-write here could let a fund go
 * negative under real concurrent load, silently violating a donor's
 * restriction on how their money can be spent.
 */
const Fund = require('../models/Fund');
const FundTransaction = require('../models/FundTransaction');
const accountingService = require('../../../services/accountingService');

function createFund(input) {
  const { companyId, name, type, purposeDescription } = input;
  if (!['restricted', 'unrestricted'].includes(type)) throw new Error('type must be "restricted" or "unrestricted".');
  return Fund.create({ companyId, name, type, purposeDescription });
}

function listFunds(companyId, { type } = {}) {
  const filter = { companyId };
  if (type) filter.type = type;
  return Fund.find(filter);
}

/** Money coming IN — no race condition risk (adding is always safe), so a plain $inc is genuinely sufficient here, not the heavier atomic-conditional pattern the outgoing side needs. */
async function recordDonation(fundId, { donorCustomerId, amount, description, receivingAccountId, donationRevenueAccountId, branchId, userId }) {
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');
  const fund = await Fund.findById(fundId);
  if (!fund) throw new Error('Fund not found.');

  const voucher = await accountingService.postVoucher({
    companyId: fund.companyId, branchId, type: 'receipt', narration: `Donation to ${fund.name}${description ? ` — ${description}` : ''}`,
    entries: [
      { accountId: receivingAccountId, debit: amount, credit: 0 },
      { accountId: donationRevenueAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'Fund', referenceId: fund._id, userId,
  });

  await Fund.updateOne({ _id: fundId }, { $inc: { balance: amount } });
  return FundTransaction.create({ companyId: fund.companyId, fundId, type: 'donation', amount, donorCustomerId, description: description || 'Donation', voucherId: voucher._id });
}

/**
 * Money going OUT — the real, atomic check. The filter itself requires
 * `balance >= amount`; if the fund doesn't currently have enough, the
 * update matches nothing and MongoDB returns null, and this rejects
 * cleanly — there is no window between checking the balance and
 * deducting it where a second concurrent disbursement could slip through.
 */
async function recordDisbursement(fundId, { amount, description, expenseAccountId, payingAccountId, branchId, userId }) {
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');

  const fund = await Fund.findOneAndUpdate(
    { _id: fundId, balance: { $gte: amount } },
    { $inc: { balance: -amount } },
    { new: true }
  );

  if (!fund) {
    const existing = await Fund.findById(fundId);
    if (!existing) throw new Error('Fund not found.');
    throw new Error(`Insufficient fund balance — this disbursement of ${amount} exceeds the ${existing.balance} currently available in "${existing.name}", even if the organization's overall cash is sufficient. Donor-restricted money can't be spent outside what's actually been given to this fund.`);
  }

  const voucher = await accountingService.postVoucher({
    companyId: fund.companyId, branchId, type: 'payment', narration: `Disbursement from ${fund.name} — ${description}`,
    entries: [
      { accountId: expenseAccountId, debit: amount, credit: 0 },
      { accountId: payingAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'Fund', referenceId: fund._id, userId,
  });

  return FundTransaction.create({ companyId: fund.companyId, fundId, type: 'disbursement', amount, description, voucherId: voucher._id });
}

function fundLedger(fundId) {
  return FundTransaction.find({ fundId }).populate('donorCustomerId', 'name').sort({ createdAt: 1 });
}

module.exports = { createFund, listFunds, recordDonation, recordDisbursement, fundLedger };
