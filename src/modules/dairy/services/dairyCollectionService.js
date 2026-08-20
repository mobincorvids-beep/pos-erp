/**
 * DairyCollectionService — quality-graded milk purchasing. The genuinely
 * new mechanic: computePrice() finds the highest fat-content band the
 * measured reading actually qualifies for (same "highest threshold met"
 * shape Distribution's quantity tiers and Fashion's markdown stages both
 * already use), but keyed by a lab measurement taken at intake, not a
 * number the buyer or seller chose. This is a PURCHASE — the business is
 * buying from a supplier — so it posts a real payable voucher through
 * core Accounting, not a checkout sale.
 */
const QualityGradeSchedule = require('../models/QualityGradeSchedule');
const MilkCollection = require('../models/MilkCollection');
const accountingService = require('../../../services/accountingService');

function createSchedule(input) {
  const { companyId, name, bands } = input;
  if (!bands || bands.length === 0) throw new Error('At least one band is required.');
  const sorted = [...bands].sort((a, b) => a.minFatPercent - b.minFatPercent);
  return QualityGradeSchedule.create({ companyId, name, bands: sorted });
}

/** Highest band whose minFatPercent the reading actually meets — the boundary itself counts. */
async function computePrice(scheduleId, fatPercent) {
  const schedule = await QualityGradeSchedule.findById(scheduleId);
  if (!schedule) throw new Error('Quality grade schedule not found.');

  let applicable = null;
  for (let i = schedule.bands.length - 1; i >= 0; i--) {
    if (fatPercent >= schedule.bands[i].minFatPercent) { applicable = schedule.bands[i]; break; }
  }
  if (!applicable) throw new Error(`Fat content ${fatPercent}% doesn't meet even the lowest configured band (${schedule.bands[0]?.minFatPercent}%) — this delivery may need to be rejected, not priced.`);
  return applicable.pricePerLitre;
}

/** Records a collection, computes its price from the schedule, and posts a real payable voucher (Dr an expense/purchase account, Cr Accounts Payable) — the business now owes this supplier real money. */
async function recordCollection(input) {
  const { companyId, branchId, supplierId, litres, fatPercent, scheduleId, expenseAccountId, payableAccountId, userId } = input;
  if (!litres || litres <= 0) throw new Error('litres must be greater than zero.');

  const pricePerLitre = await computePrice(scheduleId, fatPercent);
  const totalPayable = Math.round(litres * pricePerLitre * 100) / 100;

  const collection = await MilkCollection.create({ companyId, branchId, supplierId, litres, fatPercent, pricePerLitre, totalPayable });

  if (expenseAccountId && payableAccountId) {
    const voucher = await accountingService.postVoucher({
      companyId, branchId, type: 'journal', narration: `Milk collection — ${litres}L at ${fatPercent}% fat`,
      entries: [
        { accountId: expenseAccountId, debit: totalPayable, credit: 0 },
        { accountId: payableAccountId, debit: 0, credit: totalPayable },
      ],
      referenceType: 'MilkCollection', referenceId: collection._id, userId,
    });
    collection.voucherId = voucher._id;
    await collection.save();
  }

  return collection;
}

function listCollections(companyId, { supplierId, paid } = {}) {
  const filter = { companyId };
  if (supplierId) filter.supplierId = supplierId;
  if (paid !== undefined) filter.paid = paid === 'true' || paid === true;
  return MilkCollection.find(filter).populate('supplierId', 'name').sort({ collectedAt: -1 });
}

module.exports = { createSchedule, computePrice, recordCollection, listCollections };
