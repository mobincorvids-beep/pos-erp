const { Schema, model } = require('mongoose');

// Customer-portal / storefront cart. Either customerId (a logged-in
// PortalUser's customer, same identity req.portalAuth carries) or
// sessionId (an anonymous, not-yet-identified shopper) identifies whose
// cart this is — never both required, since an anonymous cart has no
// customerId yet. lastActivityAt drives abandoned-cart detection
// (see cartService.findAbandonedCarts) — bumped on every add/update.
const cartItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null },
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const cartSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null, index: true },
  sessionId: { type: String, default: null, index: true }, // anonymous-shopper identifier, caller-supplied
  items: [cartItemSchema],
  status: { type: String, default: 'active', enum: ['active', 'abandoned', 'converted'] },
  lastActivityAt: { type: Date, default: Date.now },
  convertedToSaleId: { type: Schema.Types.ObjectId, ref: 'Sale', default: null },
}, { timestamps: true });

cartSchema.index({ companyId: 1, customerId: 1, status: 1 });
cartSchema.index({ companyId: 1, status: 1, lastActivityAt: 1 });

module.exports = model('Cart', cartSchema);
