const { Schema, model } = require('mongoose');

// A company sets today's rate per gram for each karat they trade — jewelry
// pricing is quoted live off this, not off Product.sellingPrice (which
// would go stale the moment gold prices move, sometimes within the same day).
const goldRateSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  karat: { type: Number, required: true }, // 24, 22, 21, 18...
  ratePerGram: { type: Number, required: true },
  effectiveDate: { type: Date, default: Date.now },
}, { timestamps: true });

goldRateSchema.index({ companyId: 1, karat: 1, effectiveDate: -1 });

module.exports = model('GoldRate', goldRateSchema);
