/**
 * NotificationService — the general-purpose, event-driven notification
 * engine this app genuinely didn't have. Two real trigger points wired in
 * this round (checkLowStock in inventoryService, on approval request
 * creation in approvalService) are the proof this isn't a decorative
 * model nobody calls — a notification only exists because a real business
 * event actually happened, the same principle every other "engine" in
 * this app already follows (a Voucher only exists because real money
 * moved, a StockMovement only exists because real stock moved).
 */
const Notification = require('../models/Notification');

// 'low_stock' is constrained by a partial unique index (see Notification.js)
// to at most one UNREAD row per companyId+entityType+entityId+userId+roleId
// — every caller that fires one (inventoryService.checkLowStockAndNotify's
// per-sale check, lowStockCron's hourly sweep) writes it OUTSIDE any DB
// transaction on purpose, so a plain create() would duplicate whenever the
// caller's own transaction gets silently retried by Mongoose's
// session.withTransaction(), or whenever the per-sale check and the hourly
// cron both fire for the same still-low product. Centralized here (rather
// than reimplemented in each caller) as an upsert against that unique key:
// a "duplicate" attempt becomes a no-op update of the existing unread row
// instead of a second document — idempotent by construction, not by
// convention. Every other notification type keeps simple create()
// semantics; they're allowed multiple unread rows against the same entity
// (e.g. two @mentions in the same chat channel before either is read).
function notify({ companyId, userId, roleId, type, title, message, entityType, entityId }) {
  if (!userId && !roleId) throw new Error('A notification needs either a userId or a roleId to target.');
  if (type === 'low_stock') {
    const key = { companyId, entityType: entityType || null, entityId: entityId || null, userId: userId || null, roleId: roleId || null, read: false };
    return Notification.findOneAndUpdate(
      key,
      { $setOnInsert: { ...key, type, title, message } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).catch((err) => {
      // A duplicate-key error means two concurrent attempts raced to
      // create the same unread alert and one lost — the other one's row
      // is exactly the alert that was wanted, so this is not a failure.
      if (err.code === 11000) return Notification.findOne(key);
      throw err;
    });
  }
  return Notification.create({ companyId, userId, roleId, type, title, message, entityType, entityId });
}

/** A user sees notifications addressed to them directly, PLUS anything addressed to a role they hold, both audiences, not just one. */
function listForUser(companyId, userId, roleId, { unreadOnly } = {}) {
  const filter = {
    companyId,
    $or: [{ userId }, ...(roleId ? [{ roleId }] : [])],
  };
  if (unreadOnly) filter.read = false;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(100);
}

async function markRead(notificationId) {
  const notification = await Notification.findByIdAndUpdate(
    notificationId,
    { read: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw new Error('Notification not found.');
  return notification;
}

async function markAllRead(companyId, userId, roleId) {
  const result = await Notification.updateMany(
    { companyId, $or: [{ userId }, ...(roleId ? [{ roleId }] : [])], read: false },
    { read: true, readAt: new Date() }
  );
  return result.modifiedCount;
}

function unreadCount(companyId, userId, roleId) {
  return Notification.countDocuments({
    companyId, read: false,
    $or: [{ userId }, ...(roleId ? [{ roleId }] : [])],
  });
}

module.exports = { notify, listForUser, markRead, markAllRead, unreadCount };
