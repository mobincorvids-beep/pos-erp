const { Schema, model } = require('mongoose');

const depreciationEntrySchema = new Schema({
  period: { type: String, required: true }, // "2026-08" — the month this entry covers
  amount: { type: Number, required: true },
  bookValueAfter: { type: Number, required: true },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  postedAt: { type: Date, default: Date.now },
}, { _id: false });

// A real fixed-asset register — purchase cost, useful life, and a running
// depreciation schedule, none of which existed anywhere in this app
// before. Straight-line depreciation (the standard, simplest method):
// (purchaseCost - salvageValue) / usefulLifeMonths per month, computed
// once at asset creation and then just applied identically each period —
// deliberately not recalculated from scratch every time, so an asset's
// depreciation schedule stays consistent even if company-wide defaults
// change later (the same "snapshot the terms at creation" principle this
// whole app already uses everywhere — Hotel's ratePerNight, Layaway's
// totalPrice, now this).
const fixedAssetSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  name: { type: String, required: true },
  category: String, // "Vehicles", "Furniture", "Equipment"...
  assetAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true }, // the balance-sheet asset account this asset's value sits in
  depreciationExpenseAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true },
  accumulatedDepreciationAccountId: { type: Schema.Types.ObjectId, ref: 'Account', required: true }, // a contra-asset account — real double-entry depreciation posts here, not directly against the asset account
  purchaseDate: { type: Date, required: true },
  purchaseCost: { type: Number, required: true },
  salvageValue: { type: Number, default: 0 }, // the asset's assumed residual worth at the end of its useful life — depreciation never takes book value below this
  usefulLifeMonths: { type: Number, required: true },
  monthlyDepreciation: { type: Number, required: true }, // computed once at creation: (purchaseCost - salvageValue) / usefulLifeMonths
  accumulatedDepreciation: { type: Number, default: 0 },
  depreciationHistory: [depreciationEntrySchema],
  status: { type: String, default: 'active', enum: ['active', 'fully_depreciated', 'disposed'] },
  disposalDate: { type: Date, default: null },
  disposalProceeds: { type: Number, default: null },
  disposalGainLoss: { type: Number, default: null },

  // Who currently has custody of this asset (a laptop, a vehicle, a phone).
  // null means unassigned/in the pool. Nullable and optional so every
  // existing FixedAsset document is unaffected until someone assigns it.
  assignedToEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null },
  assignedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = model('FixedAsset', fixedAssetSchema);
