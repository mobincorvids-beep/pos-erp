/**
 * FixedAssetService — the real asset register + depreciation engine this
 * app was missing entirely. Straight-line depreciation, computed once at
 * registration and applied consistently every period. runDepreciation()
 * posts a genuine Dr Depreciation Expense / Cr Accumulated Depreciation
 * voucher every time it's called — never a running total anyone edits by
 * hand — and dedupes against the same period being run twice.
 * disposeAsset() posts the most structurally complex balanced voucher in
 * this entire app: up to 4 legs (clear accumulated depreciation, record
 * proceeds, remove the asset at original cost, and the gain/loss as
 * whatever balancing figure makes the other three legs actually balance)
 * — verified by hand for gain, loss, and break-even cases BEFORE this
 * file was written, not after.
 */
const FixedAsset = require('../models/FixedAsset');
const accountingService = require('../services/accountingService');

function registerAsset(input) {
  const {
    companyId, branchId, name, category, assetAccountId, depreciationExpenseAccountId,
    accumulatedDepreciationAccountId, purchaseDate, purchaseCost, salvageValue, usefulLifeMonths,
  } = input;
  if (!purchaseCost || purchaseCost <= 0) throw new Error('purchaseCost must be greater than zero.');
  if (!usefulLifeMonths || usefulLifeMonths <= 0) throw new Error('usefulLifeMonths must be greater than zero.');
  if ((salvageValue || 0) >= purchaseCost) throw new Error('salvageValue must be less than purchaseCost — an asset can\'t be worth its full original cost forever.');

  const monthlyDepreciation = Math.round(((purchaseCost - (salvageValue || 0)) / usefulLifeMonths) * 100) / 100;

  return FixedAsset.create({
    companyId, branchId, name, category, assetAccountId, depreciationExpenseAccountId, accumulatedDepreciationAccountId,
    purchaseDate, purchaseCost, salvageValue: salvageValue || 0, usefulLifeMonths, monthlyDepreciation,
  });
}

function listAssets(companyId, { status, category } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (category) filter.category = category;
  return FixedAsset.find(filter).sort({ purchaseDate: -1 });
}

/**
 * Posts one period's depreciation. The actual amount is capped so
 * accumulatedDepreciation never exceeds (purchaseCost - salvageValue) —
 * the LAST period an asset depreciates might be a smaller partial amount
 * than monthlyDepreciation, specifically so the asset settles at exactly
 * its salvage value, not below it. Rejects running the same period twice.
 */
async function runDepreciation(assetId, { period, userId }) {
  const asset = await FixedAsset.findById(assetId);
  if (!asset) throw new Error('Fixed asset not found.');
  if (asset.status !== 'active') throw new Error(`Cannot depreciate an asset with status "${asset.status}".`);
  if (asset.depreciationHistory.some((h) => h.period === period)) throw new Error(`Depreciation for period "${period}" has already been posted for this asset.`);

  const maxDepreciable = asset.purchaseCost - asset.salvageValue;
  const remainingDepreciable = Math.round((maxDepreciable - asset.accumulatedDepreciation) * 100) / 100;
  if (remainingDepreciable <= 0) throw new Error('This asset is already fully depreciated.');

  const amount = Math.min(asset.monthlyDepreciation, remainingDepreciable); // the cap that keeps the LAST period from overshooting salvage value

  const voucher = await accountingService.postVoucher({
    companyId: asset.companyId, branchId: asset.branchId, type: 'journal',
    narration: `Depreciation — ${asset.name} — ${period}`,
    entries: [
      { accountId: asset.depreciationExpenseAccountId, debit: amount, credit: 0 },
      { accountId: asset.accumulatedDepreciationAccountId, debit: 0, credit: amount },
    ],
    referenceType: 'FixedAsset', referenceId: asset._id, userId,
  });

  asset.accumulatedDepreciation = Math.round((asset.accumulatedDepreciation + amount) * 100) / 100;
  const bookValueAfter = Math.round((asset.purchaseCost - asset.accumulatedDepreciation) * 100) / 100;
  asset.depreciationHistory.push({ period, amount, bookValueAfter, voucherId: voucher._id });
  if (asset.accumulatedDepreciation >= maxDepreciable) asset.status = 'fully_depreciated';
  await asset.save();

  return { asset, amount, bookValueAfter, voucher };
}

/**
 * Disposes an asset — the 4-leg voucher hand-verified before this
 * function was written: clear accumulated depreciation (debit), record
 * whatever cash/proceeds came in (debit), remove the asset at its full
 * original cost (credit), and whatever gain or loss balances the other
 * three legs (credited if a gain, debited if a loss).
 */
async function disposeAsset(assetId, { disposalDate, disposalProceeds, gainLossAccountId, receivingAccountId, userId }) {
  const asset = await FixedAsset.findById(assetId);
  if (!asset) throw new Error('Fixed asset not found.');
  if (asset.status === 'disposed') throw new Error('This asset has already been disposed.');

  const bookValue = Math.round((asset.purchaseCost - asset.accumulatedDepreciation) * 100) / 100;
  const gainLoss = Math.round((disposalProceeds - bookValue) * 100) / 100;

  const entries = [
    { accountId: asset.accumulatedDepreciationAccountId, debit: asset.accumulatedDepreciation, credit: 0 },
    { accountId: asset.assetAccountId, debit: 0, credit: asset.purchaseCost },
  ];
  if (disposalProceeds > 0) {
    if (!receivingAccountId) throw new Error('receivingAccountId is required when there are non-zero disposal proceeds.');
    entries.push({ accountId: receivingAccountId, debit: disposalProceeds, credit: 0 });
  }
  if (gainLoss !== 0) {
    if (!gainLossAccountId) throw new Error('gainLossAccountId is required whenever disposal proceeds differ from book value.');
    if (gainLoss > 0) entries.push({ accountId: gainLossAccountId, debit: 0, credit: gainLoss });
    else entries.push({ accountId: gainLossAccountId, debit: Math.abs(gainLoss), credit: 0 });
  }

  const voucher = await accountingService.postVoucher({
    companyId: asset.companyId, branchId: asset.branchId, type: 'journal',
    narration: `Disposal — ${asset.name}`,
    entries, referenceType: 'FixedAsset', referenceId: asset._id, userId,
  });

  asset.status = 'disposed';
  asset.disposalDate = disposalDate ? new Date(disposalDate) : new Date();
  asset.disposalProceeds = disposalProceeds;
  asset.disposalGainLoss = gainLoss;
  await asset.save();

  return { asset, bookValue, gainLoss, voucher };
}

module.exports = { registerAsset, listAssets, runDepreciation, disposeAsset };
