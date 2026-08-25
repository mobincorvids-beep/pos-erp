const warrantyService = require('../services/warrantyService');

async function registerWarranty(req, res) {
  try {
    const warranty = await warrantyService.registerWarranty({ ...req.body, companyId: req.companyId });
    res.status(201).json(warranty);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function checkWarranty(req, res) {
  const result = await warrantyService.checkWarranty(req.companyId, req.params.serialNumber);
  res.json(result);
}

async function updateWarranty(req, res) {
  try {
    const warranty = await warrantyService.updateWarranty(req.params.id, req.body);
    res.json(warranty);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function submitClaim(req, res) {
  try {
    const claim = await warrantyService.submitClaim(req.params.warrantyId, { ...req.body, userId: req.auth.userId });
    res.status(201).json(claim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function decideClaim(req, res) {
  try {
    const claim = await warrantyService.decideClaim(req.params.id, req.body);
    res.json(claim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function linkRepairJob(req, res) {
  try {
    const claim = await warrantyService.linkRepairJob(req.params.id, req.body);
    res.json(claim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function resolveClaim(req, res) {
  try {
    const claim = await warrantyService.resolveClaim(req.params.id);
    res.json(claim);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listClaims(req, res) {
  const rows = await warrantyService.listClaims(req.companyId, req.query.warrantyId || null);
  res.json(rows);
}

module.exports = { registerWarranty, checkWarranty, updateWarranty, submitClaim, decideClaim, linkRepairJob, resolveClaim, listClaims };
