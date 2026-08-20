const BillOfMaterials = require('../models/BillOfMaterials');
const WorkOrder = require('../models/WorkOrder');
const manufacturingService = require('../services/manufacturingService');

async function listBOMs(req, res) {
  const rows = await BillOfMaterials.find({ companyId: req.companyId, isActive: true });
  res.json(rows);
}

async function createBOM(req, res) {
  try {
    const bom = await manufacturingService.createBOM({ ...req.body, companyId: req.companyId });
    res.status(201).json(bom);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listWorkOrders(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await WorkOrder.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
}

async function createWorkOrder(req, res) {
  try {
    const workOrder = await manufacturingService.createWorkOrder({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function start(req, res) {
  try {
    const workOrder = await manufacturingService.startProduction(req.params.id, req.auth.userId);
    res.json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function complete(req, res) {
  try {
    const workOrder = await manufacturingService.completeProduction(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(workOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { listBOMs, createBOM, listWorkOrders, createWorkOrder, start, complete };
