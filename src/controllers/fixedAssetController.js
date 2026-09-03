const fixedAssetService = require('../services/fixedAssetService');

async function registerAsset(req, res) {
  try { res.status(201).json(await fixedAssetService.registerAsset({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listAssets(req, res) { res.json(await fixedAssetService.listAssets(req.companyId, req.query)); }
async function runDepreciation(req, res) {
  try { res.status(201).json(await fixedAssetService.runDepreciation(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function disposeAsset(req, res) {
  try { res.json(await fixedAssetService.disposeAsset(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function assignAsset(req, res) {
  try { res.json(await fixedAssetService.assignAsset(req.params.id, req.body.employeeId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function unassignAsset(req, res) {
  try { res.json(await fixedAssetService.assignAsset(req.params.id, null)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { registerAsset, listAssets, runDepreciation, disposeAsset, assignAsset, unassignAsset };
