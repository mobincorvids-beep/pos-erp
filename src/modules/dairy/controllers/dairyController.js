const dairyCollectionService = require('../services/dairyCollectionService');

async function createSchedule(req, res) {
  try { res.status(201).json(await dairyCollectionService.createSchedule({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listSchedules(req, res) { res.json(await dairyCollectionService.listSchedules(req.companyId)); }
async function updateSchedule(req, res) {
  try { res.json(await dairyCollectionService.updateSchedule(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function deleteSchedule(req, res) {
  const schedule = await dairyCollectionService.deleteSchedule(req.params.id);
  if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });
  res.json({ ok: true });
}
async function recordCollection(req, res) {
  try { res.status(201).json(await dairyCollectionService.recordCollection({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listCollections(req, res) { res.json(await dairyCollectionService.listCollections(req.companyId, req.query)); }
module.exports = { createSchedule, listSchedules, updateSchedule, deleteSchedule, recordCollection, listCollections };
