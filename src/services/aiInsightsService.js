/**
 * AiInsightsService — rule-based business intelligence, deliberately NOT a
 * real ML model. This is honest about what it is: threshold and
 * comparison logic over the same Product/StockLevel/StockMovement/Sale
 * data every report already reads, packaged as plain-language findings
 * instead of raw numbers. Matches the proposal's "reorder recommendations,
 * slow-moving detection, sales anomaly detection" — genuinely useful
 * without pretending to be more than it is.
 */
const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockLevel = require('../models/StockLevel');
const StockMovement = require('../models/StockMovement');
const Sale = require('../models/Sale');
const reportingService = require('./reportingService');

/** Reorder recommendations: everything at/below reorderLevel, with a suggested quantity to bring it back up to maxStock (or 2x reorderLevel if maxStock isn't set). */
async function reorderRecommendations(companyId, warehouseId = null) {
  const lowStock = await reportingService.lowStockReport(companyId, warehouseId);
  const productIds = lowStock.map((r) => r.productId);
  const products = await Product.find({ _id: { $in: productIds } }).select('maxStock reorderLevel');
  const maxStockById = new Map(products.map((p) => [String(p._id), p.maxStock]));

  return lowStock.map((r) => {
    const maxStock = maxStockById.get(String(r.productId));
    const target = maxStock && maxStock > r.reorderLevel ? maxStock : r.reorderLevel * 2;
    return { ...r, suggestedReorderQuantity: Math.max(0, Math.round(target - r.quantityOnHand)) };
  });
}

/**
 * Slow-moving inventory: variants holding stock but with no 'sale' movement
 * in the last `days` days. A real dead-stock signal, not just "low
 * velocity" — reads StockMovement (the immutable ledger every sale writes
 * to), not a cached counter.
 */
async function slowMovingInventory(companyId, days = 60, warehouseId = null) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const stockMatch = { companyId: new mongoose.Types.ObjectId(companyId), quantity: { $gt: 0 } };
  if (warehouseId) stockMatch.warehouseId = new mongoose.Types.ObjectId(warehouseId);
  const levels = await StockLevel.find(stockMatch).populate('productId', 'name sku');

  const rows = [];
  for (const level of levels) {
    const recentSale = await StockMovement.findOne({
      companyId, variantId: level.variantId, type: 'sale', createdAt: { $gte: cutoff },
    });
    if (recentSale) continue;

    const lastSaleEver = await StockMovement.findOne({ companyId, variantId: level.variantId, type: 'sale' }).sort({ createdAt: -1 });

    rows.push({
      productId: level.productId?._id, productName: level.productId?.name,
      variantId: level.variantId, warehouseId: level.warehouseId,
      quantityOnHand: level.quantity,
      lastSoldAt: lastSaleEver?.createdAt || null,
      daysSinceLastSale: lastSaleEver ? Math.floor((Date.now() - lastSaleEver.createdAt) / (1000 * 60 * 60 * 24)) : null,
    });
  }

  return rows.sort((a, b) => (b.daysSinceLastSale ?? Infinity) - (a.daysSinceLastSale ?? Infinity));
}

/**
 * Sales anomaly: compares the last 7 days' daily average against the
 * preceding 30 days' daily average (a rolling baseline, not a fixed
 * target), flags when the recent week deviates by more than
 * `thresholdPercent`. Deliberately simple — a real anomaly-detection
 * system would account for day-of-week seasonality; this doesn't, and says so.
 */
async function salesAnomalies(companyId, thresholdPercent = 25) {
  const now = new Date();
  const recentStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const baselineStart = new Date(now - 37 * 24 * 60 * 60 * 1000);
  const baselineEnd = recentStart;

  const [recentAgg, baselineAgg] = await Promise.all([
    Sale.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'completed', createdAt: { $gte: recentStart, $lte: now } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
    Sale.aggregate([
      { $match: { companyId: new mongoose.Types.ObjectId(companyId), status: 'completed', createdAt: { $gte: baselineStart, $lt: baselineEnd } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]),
  ]);

  const recentDailyAvg = (recentAgg[0]?.total || 0) / 7;
  const baselineDailyAvg = (baselineAgg[0]?.total || 0) / 30;

  if (baselineDailyAvg === 0) {
    return { recentDailyAvg: Math.round(recentDailyAvg * 100) / 100, baselineDailyAvg: 0, deviationPercent: null, flagged: false, note: 'Not enough history to compare against yet.' };
  }

  const deviationPercent = Math.round(((recentDailyAvg - baselineDailyAvg) / baselineDailyAvg) * 10000) / 100;

  return {
    recentDailyAvg: Math.round(recentDailyAvg * 100) / 100,
    baselineDailyAvg: Math.round(baselineDailyAvg * 100) / 100,
    deviationPercent,
    flagged: Math.abs(deviationPercent) >= thresholdPercent,
    direction: deviationPercent >= 0 ? 'up' : 'down',
    caveat: 'Compares raw daily averages only — does not account for day-of-week or seasonal patterns.',
  };
}

/**
 * A plain-language briefing combining the above — the "why did sales
 * decrease / which products should I reorder" style summary from the
 * proposal's AI section, built from rule-based findings rather than a
 * language model, and labeled as such rather than implying otherwise.
 */
async function briefing(companyId) {
  const [reorders, slowMoving, anomaly] = await Promise.all([
    reorderRecommendations(companyId),
    slowMovingInventory(companyId, 60),
    salesAnomalies(companyId),
  ]);

  const findings = [];

  if (reorders.length > 0) {
    findings.push(`${reorders.length} product${reorders.length === 1 ? ' is' : 's are'} at or below reorder level — the most urgent is "${reorders[0].productName}" with ${reorders[0].quantityOnHand} left.`);
  }

  if (slowMoving.length > 0) {
    const worst = slowMoving[0];
    findings.push(`${slowMoving.length} product${slowMoving.length === 1 ? ' has' : 's have'} no sales in 60+ days — "${worst.productName}" hasn't sold in ${worst.daysSinceLastSale ?? 'over 60'} days.`);
  }

  if (anomaly.flagged) {
    findings.push(`Sales are ${anomaly.direction} ${Math.abs(anomaly.deviationPercent)}% this week compared to the prior month's daily average.`);
  }

  if (findings.length === 0) {
    findings.push('Nothing unusual to flag right now — stock levels and sales are within normal ranges.');
  }

  return { generatedAt: new Date(), findings, reorderCount: reorders.length, slowMovingCount: slowMoving.length, salesAnomaly: anomaly };
}

module.exports = { reorderRecommendations, slowMovingInventory, salesAnomalies, briefing };
