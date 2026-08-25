const pilgrimageService = require('../services/pilgrimageService');

async function createGroup(req, res) {
  try { res.status(201).json(await pilgrimageService.createGroup({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listGroups(req, res) { res.json(await pilgrimageService.listGroups(req.companyId, req.query)); }
async function enroll(req, res) {
  try { res.status(201).json(await pilgrimageService.enroll(req.params.groupId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function cancelEnrollment(req, res) {
  try { res.json(await pilgrimageService.cancelEnrollment(req.params.groupId, req.params.customerId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function makePayment(req, res) {
  try { res.status(201).json(await pilgrimageService.makePayment(req.params.paymentId, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listPayments(req, res) { res.json(await pilgrimageService.listPayments(req.companyId, req.query)); }
async function updateGroup(req, res) {
  try { res.json(await pilgrimageService.updateGroup(req.params.groupId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { createGroup, listGroups, enroll, cancelEnrollment, makePayment, listPayments, updateGroup };
