const { Schema, model } = require('mongoose');

const tierSchema = new Schema({
  minQuantity: { type: Number, required: true }, // this tier applies at-and-above this quantity
  unitPrice: { type: Number, required: true },
}, { _id: false });

// One schedule per variant — a quantity-break price list, the mechanic no
// other module in this app has needed: core PriceGroup gives a customer a
// flat contract price regardless of how much they buy; this makes the
// price itself a function of order quantity (buy more per line, pay less
// per unit), which is how real wholesale/distribution pricing works.
const priceTierScheduleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  minimumOrderQuantity: { type: Number, default: 1 },
  tiers: {
    type: [tierSchema],
    validate: {
      validator(tiers) {
        // Tiers must be sorted ascending by minQuantity and each strictly
        // higher than the last — an unsorted or duplicate-threshold
        // schedule would make "the applicable tier" ambiguous.
        for (let i = 1; i < tiers.length; i++) {
          if (tiers[i].minQuantity <= tiers[i - 1].minQuantity) return false;
        }
        return true;
      },
      message: 'Tiers must have strictly increasing minQuantity values.',
    },
  },
}, { timestamps: true });

priceTierScheduleSchema.index({ variantId: 1 }, { unique: true });

module.exports = model('PriceTierSchedule', priceTierScheduleSchema);
