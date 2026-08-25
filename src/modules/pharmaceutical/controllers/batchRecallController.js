const batchRecallService = require('../services/batchRecallService');

async function initiateRecall(req, res) {
  try { res.status(201).json(await batchRecallService.initiateRecall({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listRecalls(req, res) { res.json(await batchRecallService.listRecalls(req.companyId, req.query)); }
async function getRecall(req, res) {
  try { res.json(await batchRecallService.getRecall(req.params.id)); }
  catch (err) { res.status(404).json({ error: err.message }); }
}
async function updateRecall(req, res) {
  try { res.json(await batchRecallService.updateRecall(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function recordReturn(req, res) {
  try { res.json(await batchRecallService.recordReturn(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function closeRecall(req, res) {
  try { res.json(await batchRecallService.closeRecall(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { initiateRecall, listRecalls, getRecall, updateRecall, recordReturn, closeRecall };
