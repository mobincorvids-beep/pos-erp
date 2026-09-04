/**
 * DemandForecastService — closes "no formal demand forecasting or
 * statistical safety stock". Deliberately uses transparent, auditable
 * statistics (moving average, sample standard deviation, a standard
 * service-level z-score table) rather than a black-box ML model — a
 * small Pakistani retailer/distributor needs to be able to see WHY a
 * number was suggested, not just trust it. Reads directly from the
 * existing StockMovement ledger (type: 'sale'), so this needs no new
 * data collection to start working on day one.
 */
const StockMovement = require('../models/StockMovement');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');

// Standard normal z-scores for common target service levels — the
// textbook safety-stock formula (Z * σ_demand * √leadTime) needs one of
// these, not a raw percentage.
const Z_SCORE_BY_SERVICE_LEVEL = {
  0.90: 1.2816,
  0.95: 1.6449,
  0.975: 1.9600,
  0.98: 2.0537,
  0.99: 2.3263,
  0.995: 2.5758,
};

function nearestZScore(serviceLevel) {
  const levels = Object.keys(Z_SCORE_BY_SERVICE_LEVEL).map(Number);
  const nearest = levels.reduce((best, l) => (Math.abs(l - serviceLevel) < Math.abs(best - serviceLevel) ? l : best), levels[0]);
  return Z_SCORE_BY_SERVICE_LEVEL[nearest];
}

/**
 * Daily sold-quantity series for a product/variant at a warehouse over the
 * last `historyDays` days — zero-filled for days with no sale, since a
 * day with no sale is a real (low) demand data point, not a missing one.
 */
async function getDailyDemandSeries(companyId, { productId, variantId, warehouseId, historyDays = 90 }) {
  const since = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000);
  const filter = { companyId, productId, type: { $in: ['sale'] }, createdAt: { $gte: since } };
  if (variantId) filter.variantId = variantId;
  if (warehouseId) filter.warehouseId = warehouseId;

  const movements = await StockMovement.find(filter).select('quantity createdAt').lean();

  const byDay = new Map(); // 'YYYY-MM-DD' -> total units sold that day
  for (const m of movements) {
    const day = m.createdAt.toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) || 0) + Math.abs(m.quantity)); // quantity is negative for a sale
  }

  const series = [];
  for (let i = historyDays - 1; i >= 0; i--) {
    const day = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    series.push(byDay.get(day) || 0);
  }
  return series;
}

function mean(values) {
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;
}

function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / (values.length - 1); // sample std dev
  return Math.sqrt(variance);
}

/**
 * Simple moving-average forecast: average daily demand over the trailing
 * history window, projected forward `forecastDays` days. Also reports the
 * day-to-day variability (std dev) since that's what safety stock is
 * actually built from — a forecast number alone hides how reliable it is.
 */
async function forecastDemand(companyId, { productId, variantId, warehouseId, historyDays = 90, forecastDays = 30 } = {}) {
  const series = await getDailyDemandSeries(companyId, { productId, variantId, warehouseId, historyDays });
  const avgDailyDemand = mean(series);
  const dailyDemandStdDev = stdDev(series);

  return {
    productId, variantId, warehouseId,
    historyDays, forecastDays,
    avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
    dailyDemandStdDev: Math.round(dailyDemandStdDev * 100) / 100,
    forecastedDemand: Math.round(avgDailyDemand * forecastDays * 100) / 100,
    // Coefficient of variation — a cheap, honest "how much should you trust
    // this average" signal: high CV means demand is spiky/lumpy (common for
    // slow-moving or seasonal SKUs) and the moving average alone
    // understates real risk, which is exactly why safety stock below also
    // factors in stdDev rather than just padding the average.
    coefficientOfVariation: avgDailyDemand > 0 ? Math.round((dailyDemandStdDev / avgDailyDemand) * 100) / 100 : null,
  };
}

/**
 * Statistical safety stock: Z * σ_demand * √(lead time in days) — the
 * standard formula for stock held to absorb demand variability during
 * the supplier lead time, at a chosen service level (probability of NOT
 * stocking out before replenishment arrives). Also returns a suggested
 * reorder point (avg daily demand * lead time + safety stock) so this can
 * feed straight into ReorderRule without a second calculation.
 */
async function calculateSafetyStock(companyId, { productId, variantId, warehouseId, serviceLevel = 0.95, leadTimeDays, historyDays = 90 } = {}) {
  const { avgDailyDemand, dailyDemandStdDev } = await forecastDemand(companyId, { productId, variantId, warehouseId, historyDays });

  let effectiveLeadTimeDays = leadTimeDays;
  if (effectiveLeadTimeDays == null) {
    const product = await Product.findById(productId);
    if (product?.preferredSupplierId) {
      const supplier = await Supplier.findById(product.preferredSupplierId);
      effectiveLeadTimeDays = supplier?.leadTimeDays || 7;
    } else {
      effectiveLeadTimeDays = 7; // conservative default when nothing else is known
    }
  }

  const z = nearestZScore(serviceLevel);
  const safetyStock = Math.ceil(z * dailyDemandStdDev * Math.sqrt(effectiveLeadTimeDays));
  const reorderPoint = Math.ceil(avgDailyDemand * effectiveLeadTimeDays + safetyStock);

  return {
    productId, variantId, warehouseId,
    serviceLevel, zScore: z, leadTimeDays: effectiveLeadTimeDays,
    avgDailyDemand, dailyDemandStdDev,
    safetyStockQty: safetyStock,
    suggestedReorderPoint: reorderPoint,
  };
}

/** Applies a calculated safety stock straight onto Product.safetyStockQty (the field MRP already reads — see mrpService). */
async function applySafetyStock(companyId, productId, safetyStockQty) {
  const product = await Product.findOneAndUpdate(
    { _id: productId, companyId },
    { safetyStockQty },
    { new: true }
  );
  if (!product) throw new Error('Product not found.');
  return product;
}

module.exports = {
  getDailyDemandSeries,
  forecastDemand,
  calculateSafetyStock,
  applySafetyStock,
};
