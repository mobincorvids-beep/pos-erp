const storageContractService = require('../services/storageContractService');

async function createContract(req, res) {
  try { res.status(201).json(await storageContractService.createContract({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listContracts(req, res) { res.json(await storageContractService.listContracts(req.companyId, req.query)); }
async function receiveGoods(req, res) {
  try { res.status(201).json(await storageContractService.receiveGoods(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function releaseGoods(req, res) {
  try { res.status(201).json(await storageContractService.releaseGoods(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function computeStorageFee(req, res) {
  try { res.json(await storageContractService.computeStorageFee(req.params.id, req.query.periodStart, req.query.periodEnd)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function billPeriod(req, res) {
  try { res.status(201).json(await storageContractService.billPeriod(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function updateContract(req, res) {
  try { res.json(await storageContractService.updateContract(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function closeContract(req, res) {
  try { res.json(await storageContractService.closeContract(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createContract, listContracts, receiveGoods, releaseGoods, computeStorageFee, billPeriod, updateContract, closeContract };
