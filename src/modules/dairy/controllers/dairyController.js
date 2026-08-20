const dairyCollectionService = require('../services/dairyCollectionService');

async function createSchedule(req, res) {
  try { res.status(201).json(await dairyCollectionService.createSchedule({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function recordCollection(req, res) {
  try { res.status(201).json(await dairyCollectionService.recordCollection({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listCollections(req, res) { res.json(await dairyCollectionService.listCollections(req.companyId, req.query)); }
module.exports = { createSchedule, recordCollection, listCollections };
