const { Schema, model } = require('mongoose');

const registryItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, required: true },
  desiredQuantity: { type: Number, required: true },
  purchasedQuantity: { type: Number, default: 0 }, // drawn down by MANY DIFFERENT purchasers across MANY DIFFERENT independent transactions — see giftRegistryService.purchaseFromRegistry()
}, { _id: true });

// A shared want-list one customer (the owner) publishes, that OTHER,
// unrelated customers buy against — the genuinely new mechanic this
// module exists for. Every prior quota-style check in this app (Layaway's
// cumulative-payment threshold, Cafe's daily cap) belongs to a single
// customer tracking their OWN running total across their OWN actions. A
// registry's purchasedQuantity is a SHARED counter multiple different
// people draw down independently, each in their own separate checkout,
// with no coordination between them except this one number — the real
// problem is preventing the desired quantity from being exceeded by
// simultaneous, uncoordinated purchases (two different relatives buying
// the "same" gift on the same day without knowing about each other).
const giftRegistrySchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  ownerCustomerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true }, // whose registry this is (the gift recipient)
  occasion: String, // "Baby Shower", "Birthday"...
  items: [registryItemSchema],
  status: { type: String, default: 'active', enum: ['active', 'closed'] },
}, { timestamps: true });

module.exports = model('GiftRegistry', giftRegistrySchema);
