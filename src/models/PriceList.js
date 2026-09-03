const { Schema, model } = require('mongoose');

// A quantity-break tier within one product's pricing entry — buy at least
// minQuantity of the line and the unit price drops to this. Same mechanic
// as the distribution module's PriceTierSchedule, but scoped under a named
// PriceList here so it can ALSO be assigned to a customer group, not just
// a single variant in isolation.
const tierSchema = new Schema({
  minQuantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
}, { _id: false });

const priceListEntrySchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null }, // null = applies to every variant of productId
  // A flat price with no quantity break is just a single-tier array
  // (minQuantity: 1) — one shape covers both "flat price" and "slab
  // pricing" without a separate field to keep in sync.
  tiers: {
    type: [tierSchema],
    validate: {
      validator(tiers) {
        if (!tiers || tiers.length === 0) return false;
        const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
        for (let i = 1; i < sorted.length; i++) {
          if (sorted[i].minQuantity <= sorted[i - 1].minQuantity) return false;
        }
        return true;
      },
      message: 'Each price list entry needs at least one tier, with strictly increasing minQuantity values.',
    },
  },
}, { _id: false });

/**
 * PriceList — named price book ("Retail", "Wholesale", "Distributor")
 * covering many products at once, each with its own quantity-break tiers.
 * A Customer is assigned one PriceList (Customer.priceListId); a PriceList
 * can also be linked to a PriceGroup so "every Wholesale-group customer"
 * can share one book without assigning it to each customer individually
 * (customer-level priceListId still wins when both are set — see
 * priceListService.resolvePrice for the exact precedence).
 */
const priceListSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "Retail", "Wholesale", "Distributor"
  priceGroupId: { type: Schema.Types.ObjectId, ref: 'PriceGroup', default: null },
  isDefault: { type: Boolean, default: false }, // used for a customer with no priceListId/priceGroupId at all
  entries: [priceListEntrySchema],
}, { timestamps: true });

priceListSchema.index({ companyId: 1, name: 1 });

module.exports = model('PriceList', priceListSchema);
