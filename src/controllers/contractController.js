const contractService = require('../services/contractService');

async function createContract(req, res) {
  try { res.status(201).json(await contractService.createContract({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function updateContract(req, res) {
  try { res.json(await contractService.updateContract(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listContracts(req, res) {
  try { res.json(await contractService.listContracts(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getContract(req, res) {
  try { res.json(await contractService.getContract(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function activateContract(req, res) {
  try { res.json(await contractService.activateContract(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function terminateContract(req, res) {
  try { res.json(await contractService.terminateContract(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function renewContract(req, res) {
  try { res.status(201).json(await contractService.renewContract(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function expiringContracts(req, res) {
  try { res.json(await contractService.expiringContracts(req.companyId, req.query.withinDays ? Number(req.query.withinDays) : undefined)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = {
  createContract, updateContract, listContracts, getContract,
  activateContract, terminateContract, renewContract, expiringContracts,
};
