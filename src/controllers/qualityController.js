const qualityService = require('../services/qualityService');

async function createNCR(req, res) {
  try {
    res.status(201).json(await qualityService.createNCR({ ...req.body, companyId: req.companyId, reportedByUserId: req.auth.userId }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function listNCRs(req, res) {
  try { res.json(await qualityService.listNCRs(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function getNCR(req, res) {
  try { res.json(await qualityService.getNCR(req.params.id, req.companyId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function setRootCause(req, res) {
  try { res.json(await qualityService.setRootCause(req.params.id, req.companyId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function updateNCRStatus(req, res) {
  try { res.json(await qualityService.updateNCRStatus(req.params.id, req.companyId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function createCorrectiveAction(req, res) {
  try { res.status(201).json(await qualityService.createCorrectiveAction({ ...req.body, companyId: req.companyId, ncrId: req.params.id })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function listCorrectiveActions(req, res) {
  try { res.json(await qualityService.listCorrectiveActions(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function updateCorrectiveActionStatus(req, res) {
  try { res.json(await qualityService.updateCorrectiveActionStatus(req.params.actionId, req.companyId, { ...req.body, verifiedByUserId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function ncrSummary(req, res) {
  try { res.json(await qualityService.ncrSummary(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = {
  createNCR, listNCRs, getNCR, setRootCause, updateNCRStatus,
  createCorrectiveAction, listCorrectiveActions, updateCorrectiveActionStatus,
  ncrSummary,
};
