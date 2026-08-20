/**
 * BundleService — resolves a sale line item into the actual stock-affecting
 * lines. A normal product resolves to itself; a bundle (trackingMode ===
 * 'bundle') resolves to its components, each multiplied by the quantity of
 * bundles sold; a SERVICE (trackingMode === 'service' — a haircut, a
 * room-night, anything with no physical unit to hold in a warehouse)
 * resolves to NOTHING — there is no stock to check or deduct, by
 * definition. Every caller (PosSaleService, SalesOrderService — both
 * checkout and the reservation/release paths) runs its stock logic purely
 * off this function's output, so fixing "what counts as stock-affecting"
 * here fixes it everywhere at once, rather than four separate filters.
 */
const Product = require('../models/Product');

/**
 * @param {{ productId, variantId, batchId, quantity }} item - one Sale line item
 * @param {import('mongoose').ClientSession} [session]
 * @returns {Promise<Array<{ productId, variantId, batchId, quantity }>>}
 */
async function expandItem(item, session) {
  const product = await Product.findById(item.productId).session(session || null);
  if (!product) throw new Error(`Product ${item.productId} not found.`);

  if (product.trackingMode === 'service') {
    return []; // nothing to check, reserve, deduct, or release — a service isn't stock
  }

  if (product.trackingMode !== 'bundle') {
    return [{ productId: item.productId, variantId: item.variantId, batchId: item.batchId || null, quantity: item.quantity }];
  }

  if (!product.bundleComponents || product.bundleComponents.length === 0) {
    throw new Error(`Bundle "${product.name}" has no components configured.`);
  }

  return product.bundleComponents.map((c) => ({
    productId: c.productId,
    variantId: c.variantId,
    batchId: null, // bundle components don't carry a specific batch selection at this level
    quantity: c.quantity * item.quantity,
  }));
}

/** Expands a whole line-item array, flattening bundle components with regular items and dropping service lines entirely. */
async function expandItems(items, session) {
  const expanded = [];
  for (const item of items) {
    const parts = await expandItem(item, session);
    expanded.push(...parts);
  }
  return expanded;
}

module.exports = { expandItem, expandItems };
