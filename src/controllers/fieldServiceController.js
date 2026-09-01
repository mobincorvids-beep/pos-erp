const FieldServiceJob = require('../models/FieldServiceJob');
const fieldServiceService = require('../services/fieldServiceService');

async function list(req, res) {
  try {
    const { status, assignedTechnicianId, from, to } = req.query;
    const rows = await fieldServiceService.listJobs(req.companyId, { status, assignedTechnicianId, from, to });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function schedule(req, res) {
  try {
    const { from, to } = req.query;
    const rows = await fieldServiceService.technicianSchedule(req.companyId, req.params.technicianId, { from, to });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  const job = await FieldServiceJob.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!job) return res.status(404).json({ error: 'Field service job not found.' });
  res.json(job);
}

async function create(req, res) {
  try {
    const job = await fieldServiceService.createJob({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateStatus(req, res) {
  try {
    const job = await fieldServiceService.updateStatus(req.params.id, req.body.status);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateChecklist(req, res) {
  try {
    const job = await fieldServiceService.updateChecklist(req.params.id, req.body.checklist);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function addPart(req, res) {
  try {
    const job = await fieldServiceService.addPart(req.params.id, { ...req.body, userId: req.auth.userId });
    res.status(201).json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function setLaborCharge(req, res) {
  try {
    const job = await fieldServiceService.setLaborCharge(req.params.id, req.body.laborCharge);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function bill(req, res) {
  try {
    const result = await fieldServiceService.billJob(req.params.id, { ...req.body, userId: req.auth.userId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, schedule, get, create, updateStatus, updateChecklist, addPart, setLaborCharge, bill };
