const supplierOnboardingService = require('../services/supplierOnboardingService');

async function get(req, res) {
  try {
    const result = await supplierOnboardingService.getOnboarding(req.companyId, req.params.id);
    if (!result) return res.status(404).json({ error: 'Supplier not found.' });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function list(req, res) {
  try {
    const result = await supplierOnboardingService.listByStatus(req.companyId, req.query.status);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function setChecklist(req, res) {
  try {
    const result = await supplierOnboardingService.setChecklist(req.companyId, req.params.id, req.body.labels);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function submitDocument(req, res) {
  try {
    const result = await supplierOnboardingService.submitDocument(req.companyId, req.params.id, req.body.label, req.body.documentId);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function submitForReview(req, res) {
  try {
    const result = await supplierOnboardingService.submitForReview(req.companyId, req.params.id, {
      userId: req.auth.userId, note: req.body.note,
    });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function decide(req, res) {
  try {
    const result = await supplierOnboardingService.decideOnboarding(req.companyId, req.params.id, {
      approve: !!req.body.approve, userId: req.auth.userId, note: req.body.note,
    });
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { get, list, setChecklist, submitDocument, submitForReview, decide };
