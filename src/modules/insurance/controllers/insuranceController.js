const insuranceService = require('../services/insuranceService');

async function sellPolicy(req, res) {
  try { res.status(201).json(await insuranceService.sellPolicy({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listPolicies(req, res) { res.json(await insuranceService.listPolicies(req.companyId, req.query)); }
async function submitClaim(req, res) {
  try { res.status(201).json(await insuranceService.submitClaim(req.params.policyId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function decideClaim(req, res) {
  try { res.json(await insuranceService.decideClaim(req.params.claimId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listClaims(req, res) { res.json(await insuranceService.listClaims(req.companyId, req.query)); }
module.exports = { sellPolicy, listPolicies, submitClaim, decideClaim, listClaims };
