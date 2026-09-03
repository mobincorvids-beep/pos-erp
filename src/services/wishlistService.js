/**
 * WishlistService — customer-portal wishlist. Deliberately lightweight:
 * one row per saved item (see Wishlist model), scoped to the calling
 * customer only — every function here takes the customerId straight from
 * req.portalAuth (never the request body), so a customer can never read
 * or modify another customer's wishlist by passing a different id.
 */
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

async function list(companyId, customerId) {
  const items = await Wishlist.find({ companyId, customerId }).sort({ createdAt: -1 })
    .populate('productId', 'name sku barcode images sellingPrice isActive');
  return items;
}

async function add(companyId, customerId, { productId, variantId }) {
  if (!productId) throw new Error('productId is required.');
  const product = await Product.findOne({ _id: productId, companyId });
  if (!product) throw new Error('Product not found.');

  // Idempotent: re-adding an already-wishlisted item returns the existing
  // row instead of erroring, since "add to wishlist" on an already-saved
  // product is a normal, expected click from the storefront, not a mistake.
  const existing = await Wishlist.findOne({ companyId, customerId, productId, variantId: variantId || null });
  if (existing) return existing;

  return Wishlist.create({ companyId, customerId, productId, variantId: variantId || null });
}

async function remove(companyId, customerId, itemId) {
  const result = await Wishlist.findOneAndDelete({ _id: itemId, companyId, customerId });
  if (!result) throw new Error('Wishlist item not found.');
  return result;
}

module.exports = { list, add, remove };
