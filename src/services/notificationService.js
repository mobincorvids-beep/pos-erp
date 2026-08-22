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

function notify({ companyId, userId, roleId, type, title, message, entityType, entityId }) {
  if (!userId && !roleId) throw new Error('A notification needs either a userId or a roleId to target.');
  return Notification.create({ companyId, userId, roleId, type, title, message, entityType, entityId });
}

/** A user sees notifications addressed to them directly, PLUS anything addressed to a role they hold — both audiences, not just one. */
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
