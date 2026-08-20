const gymService = require('../services/gymService');

async function listClasses(req, res) {
  const rows = await gymService.listClasses(req.companyId, req.query.branchId || null);
  res.json(rows);
}

async function createClass(req, res) {
  try {
    const gymClass = await gymService.createClass({ ...req.body, companyId: req.companyId });
    res.status(201).json(gymClass);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function scheduleSession(req, res) {
  try {
    const gymSession = await gymService.scheduleSession(req.params.classId, req.body.startTime);
    res.status(201).json(gymSession);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listSessions(req, res) {
  const rows = await gymService.listSessions(req.companyId, req.query.gymClassId || null);
  res.json(rows);
}

async function sessionRoster(req, res) {
  const roster = await gymService.sessionRoster(req.params.sessionId);
  if (!roster) return res.status(404).json({ error: 'Session not found.' });
  res.json(roster);
}

async function enroll(req, res) {
  try {
    const result = await gymService.enroll(req.params.sessionId, req.body.customerId);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelEnrollment(req, res) {
  try {
    const result = await gymService.cancelEnrollment(req.params.sessionId, req.body.customerId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { listClasses, createClass, scheduleSession, listSessions, sessionRoster, enroll, cancelEnrollment };
