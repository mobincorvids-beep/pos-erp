const notificationService = require('../services/notificationService');

async function list(req, res) {
  const rows = await notificationService.listForUser(req.companyId, req.auth.userId, req.auth.roleId, { unreadOnly: req.query.unreadOnly === 'true' });
  res.json(rows);
}
async function unreadCount(req, res) {
  const count = await notificationService.unreadCount(req.companyId, req.auth.userId, req.auth.roleId);
  res.json({ count });
}
async function markRead(req, res) {
  try { res.json(await notificationService.markRead(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function markAllRead(req, res) {
  const count = await notificationService.markAllRead(req.companyId, req.auth.userId, req.auth.roleId);
  res.json({ markedCount: count });
}
module.exports = { list, unreadCount, markRead, markAllRead };
