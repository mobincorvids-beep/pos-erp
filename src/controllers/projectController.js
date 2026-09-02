const Project = require('../models/Project');
const projectService = require('../services/projectService');

async function list(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await Project.find(filter).sort({ createdAt: -1 });
  res.json(rows);
}

async function create(req, res) {
  try {
    const project = await projectService.createProject({ ...req.body, companyId: req.companyId });
    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateStatus(req, res) {
  try {
    const project = await projectService.updateStatus(req.params.id, req.body.status);
    res.json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function logManualCost(req, res) {
  try {
    const cost = await projectService.logManualCost({ ...req.body, companyId: req.companyId, projectId: req.params.id, userId: req.auth.userId });
    res.status(201).json(cost);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listCosts(req, res) {
  const rows = await projectService.listCosts(req.params.id);
  res.json(rows);
}

async function profitability(req, res) {
  try {
    const report = await projectService.profitability(req.params.id);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listDocs(req, res) {
  try { res.json(await projectService.listDocs(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function createDoc(req, res) {
  try {
    const doc = await projectService.createDoc({ ...req.body, companyId: req.companyId, projectId: req.params.id, createdBy: req.auth.userId });
    res.status(201).json(doc);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function updateDoc(req, res) {
  try { res.json(await projectService.updateDoc(req.companyId, req.params.docId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function deleteDoc(req, res) {
  try { await projectService.deleteDoc(req.companyId, req.params.docId); res.status(204).end(); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { list, create, updateStatus, logManualCost, listCosts, profitability, listDocs, createDoc, updateDoc, deleteDoc };
