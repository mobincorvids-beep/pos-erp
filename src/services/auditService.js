const AuditLog = require('../models/AuditLog');

/** Records one audit entry. Fire-and-forget is tempting but wrong here —
 * an audit trail that can silently fail defeats its own purpose, so callers
 * should await this like any other write (it's cheap: one insert). Pass a
 * Mongo session when called from inside another service's transaction, so
 * the audit entry rolls back along with everything else if that transaction fails. */
async function record({ companyId, userId, action, entityType, entityId, metadata, ipAddress }, session) {
  const [entry] = await AuditLog.create(
    [{ companyId, userId, action, entityType, entityId, metadata, ipAddress }],
    { session }
  );
  return entry;
}

function history(companyId, { entityType, entityId, userId, limit = 200 } = {}) {
  const filter = { companyId };
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = entityId;
  if (userId) filter.userId = userId;
  return AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit);
}

module.exports = { record, history };
