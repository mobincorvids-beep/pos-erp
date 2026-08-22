const billOfQuantitiesService = require('../services/billOfQuantitiesService');

async function createBOQ(req, res) {
  try { res.status(201).json(await billOfQuantitiesService.createBOQ({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getBOQ(req, res) {
  const boq = await billOfQuantitiesService.getBOQ(req.params.id);
  if (!boq) return res.status(404).json({ error: 'Bill of Quantities not found.' });
  res.json(boq);
}
async function listBOQs(req, res) { res.json(await billOfQuantitiesService.listBOQs(req.companyId, req.query.projectId)); }
async function varianceReport(req, res) {
  try { res.json(await billOfQuantitiesService.varianceReport(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { createBOQ, getBOQ, listBOQs, varianceReport };
