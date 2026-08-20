/**
 * TradeInService — vehicle trade-in credit. Structurally the exact same
 * shape as Jewelry's buyback (intake a value, hold it pending, apply it as
 * a discount on the next checkout, mark it applied afterward for audit
 * trail) — deliberately reused rather than reinvented, because the SHAPE
 * of "old thing traded in for credit toward a new purchase" is genuinely
 * identical. What's different, and what this module actually adds, is
 * that a car's value has no formula behind it (unlike weight × gold
 * rate) — it's appraisedValue, entered directly. Selling the vehicle
 * itself needs nothing new: core checkout already handles a serial-
 * tracked Product (a VIN) exactly like it handles an IMEI.
 */
const TradeInCredit = require('../models/TradeInCredit');

function intake({ companyId, customerId, vehicleDescription, appraisedValue, userId }) {
  if (!appraisedValue || appraisedValue <= 0) throw new Error('appraisedValue must be greater than zero.');
  return TradeInCredit.create({ companyId, customerId, vehicleDescription, appraisedValue, userId });
}

async function markApplied(creditId, saleId) {
  const credit = await TradeInCredit.findById(creditId);
  if (!credit) throw new Error('Trade-in credit not found.');
  if (credit.status !== 'pending') throw new Error(`Cannot apply a credit with status "${credit.status}".`);
  credit.status = 'applied';
  credit.saleId = saleId;
  await credit.save();
  return credit;
}

function listCredits(companyId, { customerId, status } = {}) {
  const filter = { companyId };
  if (customerId) filter.customerId = customerId;
  if (status) filter.status = status;
  return TradeInCredit.find(filter).populate('customerId', 'name').sort({ createdAt: -1 });
}

module.exports = { intake, markApplied, listCredits };
