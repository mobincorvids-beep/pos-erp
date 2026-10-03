const promotionService = require('../services/promotionService');
const supplierScorecardService = require('../services/supplierScorecardService');

async function createPromotion(req, res) {
  try {
    const promo = await promotionService.createPromotion({ ...req.body, companyId: req.companyId });
    res.status(201).json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPromotions(req, res) {
  const rows = await promotionService.listPromotions(req.companyId, req.query);
  res.json(rows);
}

async function setPromotionActive(req, res) {
  try {
    const promo = await promotionService.setActive(req.params.id, req.body.active);
    res.json(promo);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function evaluateCart(req, res) {
  try {
    const result = await promotionService.evaluateCart(req.companyId, req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function supplierScorecard(req, res) {
  const rows = await supplierScorecardService.supplierScorecard(req.companyId, req.query);
  res.json(rows);
}

module.exports = { createPromotion, listPromotions, setPromotionActive, evaluateCart, supplierScorecard };
