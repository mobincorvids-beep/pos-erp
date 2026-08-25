/**
 * JewelryPricingService — live weight-based pricing, the mechanic this
 * module exists to exercise. A jewelry item's actual sale price is never a
 * static Product.sellingPrice (gold moves daily, sometimes hourly) — it's
 * computed at quote time from the variant's weight, the item's karat and
 * making charge, and today's rate for that karat.
 *
 * The quoted price is what a client passes as `unitPrice` into the normal
 * posSaleService.checkout() — this module doesn't touch checkout itself,
 * it just computes the number checkout needs.
 */
const Product = require('../../../models/Product');
const GoldRate = require('../models/GoldRate');
const JewelryItemConfig = require('../models/JewelryItemConfig');

function setGoldRate(companyId, karat, ratePerGram) {
  if (!ratePerGram || ratePerGram <= 0) throw new Error('ratePerGram must be greater than zero.');
  return GoldRate.create({ companyId, karat, ratePerGram, effectiveDate: new Date() });
}

async function getCurrentRate(companyId, karat) {
  const rate = await GoldRate.findOne({ companyId, karat }).sort({ effectiveDate: -1 });
  if (!rate) throw new Error(`No gold rate set for ${karat}k — set one before quoting or selling this item.`);
  return rate;
}

function configureItem(input) {
  const { companyId, productId, variantId, karat, makingChargeType, makingChargeValue, stoneCharge } = input;
  if (!karat) throw new Error('karat is required.');
  return JewelryItemConfig.findOneAndUpdate(
    { variantId },
    { companyId, productId, variantId, karat, makingChargeType, makingChargeValue, stoneCharge },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

/**
 * @returns {Promise<{ weightGrams, karat, ratePerGram, goldValue, makingCharge, stoneCharge, totalPrice }>}
 */
/** Was missing — configured items could be created but never listed or removed.
 * Lists every jewelry pricing config for the company (item catalog view). */
function listConfigs(companyId) {
  return JewelryItemConfig.find({ companyId }).sort({ createdAt: -1 });
}

/** Removes a jewelry pricing config. Deliberately a hard delete, not a soft-deactivate:
 * unlike a salon service or membership, a config carries no history of its own — it's
 * pure pricing metadata (karat/making charge) with no other record referencing its id.
 * Past sales reference the Sale/Product, never the config. Safe to remove outright once
 * the item is no longer sold as jewelry-priced. */
async function deleteConfig(companyId, id) {
  const result = await JewelryItemConfig.findOneAndDelete({ _id: id, companyId });
  if (!result) throw new Error('Jewelry item configuration not found.');
  return result;
}

async function quotePrice(companyId, variantId) {
  const config = await JewelryItemConfig.findOne({ companyId, variantId });
  if (!config) throw new Error('This item has no jewelry pricing configuration — set its karat and making charge first.');

  const product = await Product.findOne({ companyId, 'variants._id': variantId });
  if (!product) throw new Error('Product not found.');
  const variant = product.variants.id(variantId);
  if (!variant?.weight) throw new Error('This variant has no weight recorded — required for jewelry pricing.');

  const rate = await getCurrentRate(companyId, config.karat);
  const goldValue = Math.round(variant.weight * rate.ratePerGram * 100) / 100;
  const makingCharge = config.makingChargeType === 'fixed'
    ? config.makingChargeValue
    : Math.round(goldValue * (config.makingChargeValue / 100) * 100) / 100;
  const totalPrice = Math.round((goldValue + makingCharge + config.stoneCharge) * 100) / 100;

  return {
    weightGrams: variant.weight, karat: config.karat, ratePerGram: rate.ratePerGram,
    goldValue, makingCharge, stoneCharge: config.stoneCharge, totalPrice,
  };
}

module.exports = { setGoldRate, getCurrentRate, configureItem, listConfigs, deleteConfig, quotePrice };
