const layawayService = require('../services/layawayService');

async function createPlan(req, res) {
  try {
    const plan = await layawayService.createPlan({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listPlans(req, res) {
  const rows = await layawayService.listPlans(req.companyId, req.query);
  res.json(rows);
}

async function makePayment(req, res) {
  try {
    const result = await layawayService.makePayment(req.params.id, { ...req.body, userId: req.auth.userId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelPlan(req, res) {
  try {
    const plan = await layawayService.cancelPlan(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(plan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updatePlan(req, res) {
  try {
    const plan = await layawayService.updatePlan(req.params.id, req.body);
    res.json(plan);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createPlan, listPlans, makePayment, cancelPlan, updatePlan };
