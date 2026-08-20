const { Schema, model } = require('mongoose');

// A same-day production run of a perishable item — croissants baked this
// morning are worthless by tomorrow, unlike anything tracked by core
// batch/expiry (Pharmacy's medicines are weeks-to-years, not hours). The
// genuinely new mechanic this module exists for: closing the day doesn't
// just report what's left unsold (Pharmacy's near-expiry view is passive,
// informational) — it actively converts whatever remains into a real
// recognized waste expense and removes it from stock, in one action.
const dailyBatchSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  warehouseId: { type: Schema.Types.ObjectId, ref: 'Warehouse', required: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  producedQuantity: { type: Number, required: true },
  unitCost: { type: Number, required: true },
  producedDate: { type: Date, default: Date.now },
  status: { type: String, default: 'open', enum: ['open', 'closed'] },
  wastedQuantity: { type: Number, default: 0 },
  wasteValue: { type: Number, default: 0 },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
  closedAt: Date,
}, { timestamps: true });

module.exports = model('DailyBatch', dailyBatchSchema);
