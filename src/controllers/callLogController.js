const CallLog = require('../models/CallLog');

// Simple CRUD for manual call logging — see model comment for scope
// (no real telephony integration).

async function list(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.customerId) filter.customerId = req.query.customerId;
  const rows = await CallLog.find(filter).sort({ notedAt: -1 }).limit(200);
  res.json(rows);
}

async function create(req, res) {
  try {
    const { customerId, phoneNumber, direction, notedAt, notes, durationSeconds } = req.body;
    const callLog = await CallLog.create({
      companyId: req.companyId, customerId, phoneNumber: phoneNumber || '',
      direction: direction || 'outbound', notedAt: notedAt || new Date(),
      notes: notes || '', durationSeconds: durationSeconds || null,
      userId: req.auth?.userId,
    });
    res.status(201).json(callLog);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function remove(req, res) {
  const deleted = await CallLog.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
  if (!deleted) return res.status(404).json({ error: 'Call log not found.' });
  res.json({ ok: true });
}

module.exports = { list, create, remove };
