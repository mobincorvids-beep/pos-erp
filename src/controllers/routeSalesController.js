const routeSalesService = require('../services/routeSalesService');

async function myRoute(req, res) {
  try {
    const result = await routeSalesService.getMyRoute(req.companyId, req.auth.userId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function logVisit(req, res) {
  try {
    const visit = await routeSalesService.logVisit(req.companyId, req.auth.userId, req.body);
    res.status(201).json(visit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Manager view: every route/rep assignment across the company. */
async function assignments(req, res) {
  const rows = await routeSalesService.listAllAssignments(req.companyId);
  res.json(rows);
}

/** Manager view: visit history, optionally filtered by ?salesRepId= or ?customerId=. */
async function visits(req, res) {
  const filter = {};
  if (req.query.salesRepId) filter.salesRepId = req.query.salesRepId;
  if (req.query.customerId) filter.customerId = req.query.customerId;
  const rows = await routeSalesService.listVisits(req.companyId, filter);
  res.json(rows);
}

module.exports = { myRoute, logVisit, assignments, visits };
