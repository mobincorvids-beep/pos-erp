/**
 * CartService — customer-portal / storefront cart, plus an abandoned-cart
 * query hook. Deliberately lightweight, same shape discipline as
 * wishlistService.js: every function scoped to the calling
 * customer/session only, never trusting a body-supplied id for whose cart
 * to touch.
 */
const Cart = require('../models/Cart');
const Product = require('../models/Product');

function identity({ customerId, sessionId }) {
  if (!customerId && !sessionId) throw new Error('customerId or sessionId is required.');
  return customerId ? { customerId } : { sessionId };
}

async function getOrCreateActiveCart(companyId, who) {
  const filter = { companyId, status: 'active', ...identity(who) };
  let cart = await Cart.findOne(filter);
  if (!cart) cart = await Cart.create({ companyId, ...identity(who), items: [], status: 'active', lastActivityAt: new Date() });
  return cart;
}

async function list(companyId, who) {
  return getOrCreateActiveCart(companyId, who);
}

async function addItem(companyId, who, { productId, variantId, quantity = 1 }) {
  if (!productId) throw new Error('productId is required.');
  const product = await Product.findOne({ _id: productId, companyId });
  if (!product) throw new Error('Product not found.');

  const cart = await getOrCreateActiveCart(companyId, who);
  const existing = cart.items.find((i) => String(i.productId) === String(productId) && String(i.variantId || '') === String(variantId || ''));
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.items.push({ productId, variantId: variantId || null, quantity });
  }
  cart.lastActivityAt = new Date();
  await cart.save();
  return cart;
}

async function updateItem(companyId, who, { productId, variantId, quantity }) {
  if (!productId) throw new Error('productId is required.');
  const cart = await getOrCreateActiveCart(companyId, who);
  const idx = cart.items.findIndex((i) => String(i.productId) === String(productId) && String(i.variantId || '') === String(variantId || ''));
  if (idx === -1) throw new Error('Item not in cart.');

  if (quantity <= 0) {
    cart.items.splice(idx, 1);
  } else {
    cart.items[idx].quantity = quantity;
  }
  cart.lastActivityAt = new Date();
  await cart.save();
  return cart;
}

async function clear(companyId, who) {
  const cart = await getOrCreateActiveCart(companyId, who);
  cart.items = [];
  cart.lastActivityAt = new Date();
  await cart.save();
  return cart;
}

/**
 * Active carts with no activity in at least `inactiveSinceHours`, per
 * company — the query hook a future notification sweep (cron/job) would
 * call to find abandoned-cart-recovery candidates. Does not mark them
 * abandoned itself (a sweep job, not built here, would own that decision
 * and any email/SMS send); this is read-only.
 */
function findAbandonedCarts(companyId, inactiveSinceHours = 24) {
  const cutoff = new Date(Date.now() - inactiveSinceHours * 60 * 60 * 1000);
  return Cart.find({
    companyId, status: 'active',
    lastActivityAt: { $lte: cutoff },
    'items.0': { $exists: true }, // only carts that actually have items — an empty cart isn't "abandoned"
  }).sort({ lastActivityAt: 1 });
}

/** Marks carts matching findAbandonedCarts' criteria as status: 'abandoned' — a convenience a sweep job can call after reading the candidates, kept separate so the read (findAbandonedCarts) has no side effect on its own. */
async function markAbandoned(companyId, inactiveSinceHours = 24) {
  const cutoff = new Date(Date.now() - inactiveSinceHours * 60 * 60 * 1000);
  const result = await Cart.updateMany(
    { companyId, status: 'active', lastActivityAt: { $lte: cutoff }, 'items.0': { $exists: true } },
    { $set: { status: 'abandoned' } }
  );
  return { matched: result.matchedCount ?? result.n, modified: result.modifiedCount ?? result.nModified };
}

module.exports = { list, addItem, updateItem, clear, findAbandonedCarts, markAbandoned };
