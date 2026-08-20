const hospitalService = require('../services/hospitalService');

async function checkIn(req, res) {
  try {
    const visit = await hospitalService.checkIn({ ...req.body, companyId: req.companyId });
    res.status(201).json(visit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function currentQueue(req, res) {
  try {
    const rows = await hospitalService.currentQueue(req.query.branchId);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function callNext(req, res) {
  try {
    const visit = await hospitalService.callNext(req.body.branchId, req.body.employeeId);
    res.json(visit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listVisits(req, res) {
  const rows = await hospitalService.listVisits(req.companyId, req.query);
  res.json(rows);
}

async function completeVisit(req, res) {
  try {
    const result = await hospitalService.completeVisit(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelVisit(req, res) {
  try {
    const visit = await hospitalService.cancelVisit(req.params.id);
    res.json(visit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { checkIn, currentQueue, callNext, listVisits, completeVisit, cancelVisit };
