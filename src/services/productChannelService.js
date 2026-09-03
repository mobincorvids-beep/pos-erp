/**
 * ProductChannelService — resolves a product's effective price/content for
 * a given sales channel (ecommerce, a specific SalesChannel, etc.) against
 * Product.channelOverrides. A product with no override for the requested
 * channel, or no channelOverrides at all, falls back to its base
 * price/name/description exactly as every existing reader of Product
 * already expects — this is purely additive.
 */
const Product = require('../models/Product');

/**
 * @param {String} productId
 * @param {String} channel - the channel key (e.g. 'ecommerce', or a SalesChannel._id string)
 * @returns {Promise<Object>} the product with an effective { price, title, description, isVisible, variantPrices } for that channel
 */
async function getEffectiveProductForChannel(productId, channel) {
  const product = await Product.findById(productId);
  if (!product) throw new Error('Product not found.');

  const override = product.channelOverrides ? product.channelOverrides.get(channel) : null;

  return {
    productId: product._id,
    channel,
    price: override && override.price !== null && override.price !== undefined ? override.price : product.sellingPrice,
    title: override && override.title ? override.title : product.name,
    description: override && override.description ? override.description : product.description,
    isVisible: override ? override.isVisible !== false : true,
    hasOverride: !!override,
  };
}

/** Sets (or clears, when fields is null) this product's override for one channel. */
async function setChannelOverride(companyId, productId, channel, fields) {
  const product = await Product.findOne({ _id: productId, companyId });
  if (!product) throw new Error('Product not found.');

  if (!product.channelOverrides) product.channelOverrides = new Map();
  if (fields === null) {
    product.channelOverrides.delete(channel);
  } else {
    const existing = product.channelOverrides.get(channel) || {};
    product.channelOverrides.set(channel, { ...existing, ...fields });
  }
  await product.save();
  return product;
}

module.exports = { getEffectiveProductForChannel, setChannelOverride };
