const { Schema, model } = require('mongoose');

// Two shapes of promotion in one model rather than two separate ones,
// because they share almost everything (name, active window, branch
// scope) and only differ in how the discount is computed — `type`
// decides which of the two detail blocks below actually applies.
//
// buy_x_get_y: buy `triggerQuantity` of the trigger item, get
// `rewardQuantity` of the reward item (can be the same product, or a
// different one) at `rewardDiscountPercent` off — 100 means free.
//
// bundle: buying the exact set of `bundleItems` together at their normal
// prices would cost more than `bundlePrice` — the saving IS the promotion.
//
// Deliberately does NOT auto-apply inside posSaleService.checkout — the
// same "staff quotes it, then applies it manually as a line discount at
// checkout" pattern this app already uses for loyalty-point redemption
// and buyback credit (see CustomersPage's redeem-loyalty flow), rather
// than silently rewriting cart totals inside the core checkout path every
// industry's sales flow shares. evaluate() in promotionService tells
// staff exactly what a given cart qualifies for and how much to discount.
const promotionSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', default: null }, // null = all branches
  name: { type: String, required: true },
  type: { type: String, required: true, enum: ['buy_x_get_y', 'bundle'] },
  active: { type: Boolean, default: true },
  startDate: { type: Date, default: null },
  endDate: { type: Date, default: null },

  // buy_x_get_y fields
  triggerVariantId: { type: Schema.Types.ObjectId, default: null },
  triggerQuantity: { type: Number, default: null },
  rewardVariantId: { type: Schema.Types.ObjectId, default: null },
  rewardQuantity: { type: Number, default: null },
  rewardDiscountPercent: { type: Number, default: null }, // 100 = free

  // bundle fields
  bundleItems: [{
    productId: { type: Schema.Types.ObjectId, ref: 'Product' },
    variantId: { type: Schema.Types.ObjectId },
    quantity: { type: Number, default: 1 },
    _id: false,
  }],
  bundlePrice: { type: Number, default: null },
}, { timestamps: true });

module.exports = model('Promotion', promotionSchema);
