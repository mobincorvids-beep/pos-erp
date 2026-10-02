const jewelryPricingService = require('../services/jewelryPricingService');
const buybackService = require('../services/buybackService');
const goldSavingsService = require('../services/goldSavingsService');
const GoldRate = require('../models/GoldRate');

async function currentRates(req, res) {
  // Latest rate per karat this company has ever set — one query, grouped in JS since there are only a handful of karats.
  const all = await GoldRate.find({ companyId: req.companyId }).sort({ effectiveDate: -1 });
  const latestByKarat = new Map();
  for (const r of all) {
    if (!latestByKarat.has(r.karat)) latestByKarat.set(r.karat, r);
  }
  res.json(Array.from(latestByKarat.values()));
}

async function setRate(req, res) {
  try {
    const rate = await jewelryPricingService.setGoldRate(req.companyId, req.body.karat, req.body.ratePerGram);
    res.status(201).json(rate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function configureItem(req, res) {
  try {
    const config = await jewelryPricingService.configureItem({ ...req.body, companyId: req.companyId });
    res.status(201).json(config);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listConfigs(req, res) {
  const rows = await jewelryPricingService.listConfigs(req.companyId);
  res.json(rows);
}

async function deleteConfig(req, res) {
  try {
    await jewelryPricingService.deleteConfig(req.companyId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function quote(req, res) {
  try {
    const result = await jewelryPricingService.quotePrice(req.companyId, req.params.variantId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function intakeBuyback(req, res) {
  try {
    const buyback = await buybackService.intake({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(buyback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function markBuybackApplied(req, res) {
  try {
    const buyback = await buybackService.markApplied(req.params.id, req.body.saleId);
    res.json(buyback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelBuyback(req, res) {
  try {
    const buyback = await buybackService.cancel(req.params.id);
    res.json(buyback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function customerBuybacks(req, res) {
  const rows = await buybackService.listForCustomer(req.companyId, req.params.customerId);
  res.json(rows);
}

async function karatValuationReport(req, res) {
  const report = await jewelryPricingService.karatValuationReport(req.companyId);
  res.json(report);
}

async function enrollGoldSavings(req, res) {
  try {
    const scheme = await goldSavingsService.enroll({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(scheme);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listGoldSavings(req, res) {
  const rows = await goldSavingsService.listSchemes(req.companyId, { customerId: req.query.customerId, status: req.query.status });
  res.json(rows);
}

async function recordGoldSavingsInstallment(req, res) {
  try {
    const scheme = await goldSavingsService.recordInstallment(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(scheme);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelGoldSavings(req, res) {
  try {
    const scheme = await goldSavingsService.cancel(req.params.id);
    res.json(scheme);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function redeemGoldSavings(req, res) {
  try {
    const result = await goldSavingsService.redeem(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  currentRates, setRate, configureItem, listConfigs, deleteConfig, quote,
  intakeBuyback, markBuybackApplied, cancelBuyback, customerBuybacks,
  karatValuationReport,
  enrollGoldSavings, listGoldSavings, recordGoldSavingsInstallment, cancelGoldSavings, redeemGoldSavings,
};
