const { Schema, model } = require('mongoose');

// One farmer's delivery — the measured fatPercent at intake determines the
// price paid, via the QualityGradeSchedule's bands. This is a PURCHASE
// (the business buying milk from a supplier), not a sale, so it bills
// through core Purchasing/Accounting logic, not checkout.
const milkCollectionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  supplierId: { type: Schema.Types.ObjectId, ref: 'Supplier', required: true },
  litres: { type: Number, required: true },
  fatPercent: { type: Number, required: true }, // the actual lab/hydrometer reading at intake
  pricePerLitre: { type: Number, required: true }, // computed from the band the fatPercent falls into
  totalPayable: { type: Number, required: true },
  collectedAt: { type: Date, default: Date.now },
  paid: { type: Boolean, default: false },
  voucherId: { type: Schema.Types.ObjectId, ref: 'Voucher', default: null },
}, { timestamps: true });

module.exports = model('MilkCollection', milkCollectionSchema);
