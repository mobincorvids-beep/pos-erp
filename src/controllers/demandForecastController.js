const demandForecastService = require('../services/demandForecastService');

function parseQuery(req) {
  const { productId, variantId, warehouseId, historyDays, forecastDays, serviceLevel, leadTimeDays } = req.query;
  return {
    productId, variantId, warehouseId,
    historyDays: historyDays ? Number(historyDays) : undefined,
    forecastDays: forecastDays ? Number(forecastDays) : undefined,
    serviceLevel: serviceLevel ? Number(serviceLevel) : undefined,
    leadTimeDays: leadTimeDays ? Number(leadTimeDays) : undefined,
  };
}

async function forecast(req, res) {
  try {
    const result = await demandForecastService.forecastDemand(req.companyId, parseQuery(req));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function safetyStock(req, res) {
  try {
    const result = await demandForecastService.calculateSafetyStock(req.companyId, parseQuery(req));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function applySafetyStock(req, res) {
  try {
    const { productId, safetyStockQty } = req.body;
    const product = await demandForecastService.applySafetyStock(req.companyId, productId, safetyStockQty);
    res.json(product);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { forecast, safetyStock, applySafetyStock };
