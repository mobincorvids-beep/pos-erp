const Company = require('../models/Company');
const Account = require('../models/Account');
const { FALLBACKS } = require('../services/defaultAccountsService');

/** Shows both the explicit mapping and what each slot would currently resolve to (explicit, or the name-based fallback) — so a company can tell at a glance which slots are configured vs guessed. */
async function get(req, res) {
  const company = await Company.findById(req.companyId);
  const accounts = await Account.find({ companyId: req.companyId, isActive: true }).select('name type');

  const slots = {};
  for (const key of Object.keys(FALLBACKS)) {
    const explicitId = company.defaultAccounts?.[key];
    slots[key] = {
      accountId: explicitId || null,
      source: explicitId ? 'explicit' : 'fallback',
    };
  }

  res.json({ defaultAccounts: slots, accounts });
}

async function update(req, res) {
  const validKeys = Object.keys(FALLBACKS);
  const patch = {};
  for (const key of validKeys) {
    if (req.body[key] !== undefined) patch[`defaultAccounts.${key}`] = req.body[key] || null;
  }

  const company = await Company.findByIdAndUpdate(req.companyId, { $set: patch }, { new: true });
  res.json(company.defaultAccounts);
}

module.exports = { get, update };
