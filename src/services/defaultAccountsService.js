/**
 * DefaultAccountsService — the single place that resolves "which account
 * does this automatic posting go to." Prefers Company.defaultAccounts
 * (explicit, set once at onboarding or via Settings) and only falls back
 * to guessing by account name when a company has no explicit wiring —
 * e.g. one whose accounts were created by hand outside the normal
 * onboarding flow. Every service that used to run its own regex query
 * now calls resolve() instead, so there's one behavior to reason about,
 * not nine slightly-different copies of the same fallback.
 */
const Company = require('../models/Company');
const Account = require('../models/Account');

const FALLBACKS = {
  inventoryAssetId: { type: 'asset', pattern: /inventory/i },
  costOfGoodsSoldId: { type: 'expense', pattern: /cost of goods/i },
  accountsReceivableId: { type: 'asset', pattern: /receivable/i },
  accountsPayableId: { type: 'liability', pattern: /payable/i },
  salariesExpenseId: { type: 'expense', pattern: /salar/i },
  salesTaxPayableId: { type: 'liability', pattern: /tax/i },
  salesRevenueId: { type: 'income', pattern: /revenue/i },
};

/**
 * @param {String} companyId
 * @param {'inventoryAssetId'|'costOfGoodsSoldId'|'accountsReceivableId'|'accountsPayableId'|'salariesExpenseId'|'salesTaxPayableId'} key
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<import('mongoose').Types.ObjectId|null>}
 */
async function resolve(companyId, key, session) {
  const company = await Company.findById(companyId).session(session || null);
  const explicit = company?.defaultAccounts?.[key];
  if (explicit) return explicit;

  const fallback = FALLBACKS[key];
  if (!fallback) throw new Error(`Unknown default-account key "${key}".`);

  const account = await Account.findOne(
    { companyId, type: fallback.type, name: fallback.pattern }
  ).session(session || null);
  return account?._id || null;
}

/** Bulk-resolve several keys in one call — convenience for services that need more than one (e.g. purchaseService needs inventory + payable). */
async function resolveMany(companyId, keys, session) {
  const results = {};
  for (const key of keys) {
    results[key] = await resolve(companyId, key, session);
  }
  return results;
}

module.exports = { resolve, resolveMany, FALLBACKS };
