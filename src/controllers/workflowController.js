const approvalService = require('../services/approvalService');

async function defineWorkflow(req, res) {
  try { res.status(201).json(await approvalService.defineWorkflow({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getWorkflow(req, res) {
  const workflow = await approvalService.getWorkflow(req.companyId, req.params.entityType);
  if (!workflow) return res.status(404).json({ error: 'No workflow configured for this entity type — it uses the default single-step behavior.' });
  res.json(workflow);
}
module.exports = { defineWorkflow, getWorkflow };
