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
const StockLevel = require('../../../models/StockLevel');
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
  const {
    companyId, productId, variantId, karat, makingChargeType, makingChargeValue, stoneCharge,
    hallmarkNumber, hallmarkingAuthority, hallmarkedAt,
    stoneCertNumber, stoneCertAuthority, stoneCertDetails,
  } = input;
  if (!karat) throw new Error('karat is required.');
  return JewelryItemConfig.findOneAndUpdate(
    { variantId },
    {
      companyId, productId, variantId, karat, makingChargeType, makingChargeValue, stoneCharge,
      hallmarkNumber: hallmarkNumber || null,
      hallmarkingAuthority: hallmarkingAuthority || null,
      hallmarkedAt: hallmarkedAt || null,
      stoneCertNumber: stoneCertNumber || null,
      stoneCertAuthority: stoneCertAuthority || null,
      stoneCertDetails: stoneCertDetails || null,
    },
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

/**
 * Karat-wise stock valuation — a plain "total inventory cost" report means
 * nothing in this trade the way it does elsewhere: gold's own value moves
 * daily, so the useful number is "how much gold weight (and its current
 * market value) am I holding, broken down by karat" — not a static cost
 * figure frozen at purchase time. Walks every configured jewelry item,
 * sums its on-hand weight across all warehouses, and re-prices that
 * weight at today's rate for that karat.
 */
async function karatValuationReport(companyId) {
  const configs = await JewelryItemConfig.find({ companyId });
  if (configs.length === 0) return { asOf: new Date(), karats: [], grandTotalValue: 0 };

  const rates = await GoldRate.find({ companyId }).sort({ effectiveDate: -1 });
  const latestRateByKarat = new Map();
  for (const r of rates) if (!latestRateByKarat.has(r.karat)) latestRateByKarat.set(r.karat, r.ratePerGram);

  const byKarat = new Map(); // karat -> { itemCount, totalWeightGrams, totalValue, items: [] }

  for (const config of configs) {
    const product = await Product.findOne({ companyId, 'variants._id': config.variantId });
    const variant = product?.variants?.id(config.variantId);
    if (!variant?.weight) continue; // unweighted variant — can't value it by weight, skip

    const stockLines = await StockLevel.find({ companyId, variantId: config.variantId });
    const onHandUnits = stockLines.reduce((sum, s) => sum + s.quantity, 0);
    if (onHandUnits <= 0) continue;

    const weightGrams = onHandUnits * variant.weight;
    const ratePerGram = latestRateByKarat.get(config.karat) || 0;
    const value = Math.round(weightGrams * ratePerGram * 100) / 100;

    if (!byKarat.has(config.karat)) byKarat.set(config.karat, { karat: config.karat, itemCount: 0, totalWeightGrams: 0, totalValue: 0, items: [] });
    const bucket = byKarat.get(config.karat);
    bucket.itemCount += 1;
    bucket.totalWeightGrams += weightGrams;
    bucket.totalValue += value;
    bucket.items.push({
      productId: product._id, variantId: config.variantId,
      productName: product.name, sku: variant.sku,
      onHandUnits, weightGrams, ratePerGram, value,
      hallmarkNumber: config.hallmarkNumber,
    });
  }

  const karats = Array.from(byKarat.values()).sort((a, b) => b.karat - a.karat);
  const grandTotalValue = Math.round(karats.reduce((sum, k) => sum + k.totalValue, 0) * 100) / 100;
  return { asOf: new Date(), karats, grandTotalValue };
}

module.exports = { setGoldRate, getCurrentRate, configureItem, listConfigs, deleteConfig, quotePrice, karatValuationReport };
