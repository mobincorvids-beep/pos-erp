const { Schema, model } = require('mongoose');

// One row per saved item, rather than one Wishlist document per customer
// with an embedded product array — this way adding/removing a single item
// is a single insert/delete instead of a read-modify-write on a growing
// array, and the same uniqueness index below makes "add" naturally
// idempotent (adding an already-wishlisted product is a no-op, not a
// duplicate row).
const wishlistItemSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  variantId: { type: Schema.Types.ObjectId, default: null }, // optional — null means "the product generally", not one specific variant
}, { timestamps: true });

wishlistItemSchema.index({ customerId: 1, productId: 1, variantId: 1 }, { unique: true });

module.exports = model('Wishlist', wishlistItemSchema);
