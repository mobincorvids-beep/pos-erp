const AuditLog = require('../../models/AuditLog');

/** Same data as the tenant-scoped audit log, minus the companyId requirement — this is the one place a company-scoping filter is optional by design, not an oversight. */
async function list(req, res) {
  const filter = {};
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.entityType) filter.entityType = req.query.entityType;
  if (req.query.action) filter.action = req.query.action;

  const rows = await AuditLog.find(filter)
    .populate('companyId', 'name')
    .sort({ createdAt: -1 })
    .limit(Number(req.query.limit) || 200);
  res.json(rows);
}

module.exports = { list };
