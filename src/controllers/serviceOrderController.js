const ServiceOrder = require('../models/ServiceOrder');
const serviceOrderService = require('../services/serviceOrderService');

async function list(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.assignedTechnicianId) filter.assignedTechnicianId = req.query.assignedTechnicianId;
  const rows = await ServiceOrder.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
}

async function create(req, res) {
  try {
    const serviceOrder = await serviceOrderService.create({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(serviceOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateStatus(req, res) {
  try {
    const serviceOrder = await serviceOrderService.updateStatus(req.params.id, req.body.status, { diagnosisNote: req.body.diagnosisNote });
    res.json(serviceOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function addPart(req, res) {
  try {
    const serviceOrder = await serviceOrderService.addPart(req.params.id, { ...req.body, userId: req.auth.userId });
    res.status(201).json(serviceOrder);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function setLaborCharge(req, res) {
  const serviceOrder = await serviceOrderService.setLaborCharge(req.params.id, req.body.laborCharge);
  res.json(serviceOrder);
}

async function bill(req, res) {
  try {
    const result = await serviceOrderService.billServiceOrder(req.params.id, { ...req.body, userId: req.auth.userId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, create, updateStatus, addPart, setLaborCharge, bill };
