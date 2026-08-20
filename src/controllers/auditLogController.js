const auditService = require('../services/auditService');

async function list(req, res) {
  const { entityType, entityId, userId, limit } = req.query;
  const rows = await auditService.history(req.companyId, { entityType, entityId, userId, limit: limit ? Number(limit) : undefined });
  res.json(rows);
}

module.exports = { list };
