const { Schema, model } = require('mongoose');

// Jewelry-specific overlay on a core Product/variant — same pattern as
// SalonService overlaying a Product with commission info. Core stays
// generic (a Product with isWeightBased + variant.weight); this is where
// "which karat, what making charge" actually lives, since those concepts
// mean nothing to a non-jewelry business.
const jewelryItemConfigSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  karat: { type: Number, required: true },
  makingChargeType: { type: String, default: 'percentage', enum: ['fixed', 'percentage'] },
  makingChargeValue: { type: Number, default: 0 }, // fixed currency amount, or percent of gold value
  stoneCharge: { type: Number, default: 0 }, // flat addition for stones/diamonds, not priced by weight
}, { timestamps: true });

jewelryItemConfigSchema.index({ variantId: 1 }, { unique: true });

module.exports = model('JewelryItemConfig', jewelryItemConfigSchema);
