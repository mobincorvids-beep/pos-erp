/**
 * InsuranceService — genuinely combines two proven shapes rather than
 * inventing either from scratch: sellPolicy() is Cafe's subscription-sale
 * pattern (bill through checkout, hold a validity period); the claim
 * workflow (submit -> decide) is Electronics' warranty-claim pattern.
 * What's actually NEW here, not reused from anywhere: claimAmount is
 * checked against the policy's real coverageAmount ceiling at submission
 * (a currency check neither prior module needed), and an APPROVED claim
 * posts a genuine payout voucher at decision time — Electronics' claims
 * link to a repair job instead of moving cash; an insurance claim's whole
 * point is that money actually has to move.
 */
const InsurancePolicy = require('../models/InsurancePolicy');
const InsuranceClaim = require('../models/InsuranceClaim');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

async function sellPolicy(input) {
  const {
    companyId, branchId, customerId, policyType, coverageAmount, premiumAmount, startDate, endDate,
    billingProductId, billingVariantId, warehouseId, paymentAccountId, posTerminalId, userId,
  } = input;
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');
  if (!coverageAmount || coverageAmount <= 0) throw new Error('coverageAmount must be greater than zero.');

  const sale = await posSaleService.checkout({
    companyId, branchId, warehouseId, customerId, posTerminalId, userId,
    items: [{ productId: billingProductId, variantId: billingVariantId, quantity: 1, unitPrice: premiumAmount }],
    payments: [{ paymentAccountId, method: 'cash', amount: premiumAmount }],
  });

  return InsurancePolicy.create({ companyId, branchId, customerId, policyType, coverageAmount, premiumAmount, startDate, endDate, saleId: sale._id });
}

function listPolicies(companyId, { customerId, status } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  return InsurancePolicy.find(filter).populate('customerId', 'name').sort({ createdAt: -1 });
}

/** Exactly Electronics' submitClaim shape (validity check first), PLUS the genuinely new part: claimAmount can never exceed the policy's real coverageAmount. */
async function submitClaim(policyId, { claimAmount, description, userId }) {
  const policy = await InsurancePolicy.findById(policyId);
  if (!policy) throw new Error('Policy not found.');
  if (new Date() > policy.endDate) throw new Error(`This policy expired on ${policy.endDate.toDateString()} — no new claims can be submitted against it.`);
  if (!claimAmount || claimAmount <= 0) throw new Error('claimAmount must be greater than zero.');
  if (claimAmount > policy.coverageAmount) throw new Error(`Claim amount (${claimAmount}) exceeds this policy's coverage of ${policy.coverageAmount} — cannot submit a claim above the actual insured ceiling.`);

  return InsuranceClaim.create({ companyId: policy.companyId, branchId: policy.branchId, policyId, claimAmount, description });
}

/**
 * Decides a claim — a rejection is exactly Electronics' decideClaim shape
 * (just a status flip). An APPROVAL is the genuinely new part: posts a
 * real payout voucher (Dr Claims Expense, Cr Cash/Bank) immediately, since
 * "approved" and "money has actually moved" are the same moment for an
 * insurance claim in a way they never were for a repair-linked warranty claim.
 */
async function decideClaim(claimId, { approve, decisionNote, payoutAccountId, claimsExpenseAccountId, userId }) {
  const claim = await InsuranceClaim.findById(claimId);
  if (!claim) throw new Error('Claim not found.');
  if (claim.status !== 'submitted') throw new Error(`Cannot decide a claim with status "${claim.status}".`);

  if (!approve) {
    claim.status = 'rejected';
    claim.decisionNote = decisionNote;
    await claim.save();
    return claim;
  }

  if (!payoutAccountId || !claimsExpenseAccountId) throw new Error('payoutAccountId and claimsExpenseAccountId are required to approve and pay out a claim.');

  const voucher = await accountingService.postVoucher({
    companyId: claim.companyId, branchId: claim.branchId, type: 'payment', narration: `Insurance claim payout — ${claim.description}`,
    entries: [
      { accountId: claimsExpenseAccountId, debit: claim.claimAmount, credit: 0 },
      { accountId: payoutAccountId, debit: 0, credit: claim.claimAmount },
    ],
    referenceType: 'InsuranceClaim', referenceId: claim._id, userId,
  });

  claim.status = 'paid';
  claim.decisionNote = decisionNote;
  claim.voucherId = voucher._id;
  await claim.save();
  return claim;
}

function listClaims(companyId, { policyId, status } = {}) {
  const filter = { companyId };
  if (policyId) filter.policyId = policyId;
  if (status) filter.status = status;
  return InsuranceClaim.find(filter).sort({ createdAt: -1 });
}

module.exports = { sellPolicy, listPolicies, submitClaim, decideClaim, listClaims };
