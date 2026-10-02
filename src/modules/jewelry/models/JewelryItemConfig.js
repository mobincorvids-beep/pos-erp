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

  // Purity hallmarking — required by regulators in many markets before an
  // item can legally be sold as "22k"/"18k" etc, and a real trust signal
  // customers ask for regardless. Optional (not every configured item is
  // hallmarked yet, e.g. still awaiting certification), which is also why
  // this lives here rather than as a required field on intake.
  hallmarkNumber: { type: String, default: null },
  hallmarkingAuthority: { type: String, default: null }, // e.g. "BIS", "PSQCA"
  hallmarkedAt: { type: Date, default: null },

  // Stone/diamond certification — separate from hallmarking (that's about
  // the metal's purity; this is about a set stone's authenticity/grade).
  // Only meaningful when stoneCharge > 0, but not enforced as a hard
  // dependency — a config can carry stone charge without a lab cert yet.
  stoneCertNumber: { type: String, default: null },
  stoneCertAuthority: { type: String, default: null }, // e.g. "GIA", "IGI"
  stoneCertDetails: { type: String, default: null }, // free text: carat/clarity/color/cut summary
}, { timestamps: true });

jewelryItemConfigSchema.index({ variantId: 1 }, { unique: true });

module.exports = model('JewelryItemConfig', jewelryItemConfigSchema);
