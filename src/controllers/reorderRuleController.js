const reorderRuleService = require('../services/reorderRuleService');

async function listRules(req, res) {
  try {
    const rules = await reorderRuleService.listRules(req.companyId, { warehouseId: req.query.warehouseId });
    res.json(rules);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function upsertRule(req, res) {
  try {
    const rule = await reorderRuleService.upsertRule({ ...req.body, companyId: req.companyId });
    res.status(201).json(rule);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function deleteRule(req, res) {
  try {
    await reorderRuleService.deleteRule(req.params.id, req.companyId);
    res.status(204).end();
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function belowReorderPoint(req, res) {
  try {
    if (!req.query.warehouseId) return res.status(400).json({ error: 'warehouseId is required.' });
    const results = await reorderRuleService.listBelowReorderPoint(req.companyId, req.query.warehouseId);
    res.json(results);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { listRules, upsertRule, deleteRule, belowReorderPoint };
