const maintenanceService = require('../services/maintenanceService');

async function createPlan(req, res) {
  try { res.status(201).json(await maintenanceService.createPlan({ ...req.body, companyId: req.companyId, createdBy: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listPlans(req, res) { res.json(await maintenanceService.listPlans(req.companyId, req.query)); }
async function updatePlan(req, res) {
  try { res.json(await maintenanceService.updatePlan(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function openWorkOrder(req, res) {
  try { res.status(201).json(await maintenanceService.openWorkOrder({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listWorkOrders(req, res) { res.json(await maintenanceService.listWorkOrders(req.companyId, req.query)); }
async function completeWorkOrder(req, res) {
  try { res.json(await maintenanceService.completeWorkOrder(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function cancelWorkOrder(req, res) {
  const workOrder = await maintenanceService.cancelWorkOrder(req.params.id);
  if (!workOrder) return res.status(400).json({ error: 'Work order not found or already completed/cancelled.' });
  res.json(workOrder);
}
async function assetMaintenanceHistory(req, res) {
  res.json(await maintenanceService.assetMaintenanceHistory(req.params.assetId));
}

module.exports = { createPlan, listPlans, updatePlan, openWorkOrder, listWorkOrders, completeWorkOrder, cancelWorkOrder, assetMaintenanceHistory };
