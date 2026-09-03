const changeOrderService = require('../services/changeOrderService');

async function list(req, res) {
  try {
    const rows = await changeOrderService.listChangeOrders(req.companyId, req.query.projectId || null, req.query.status || null);
    res.json(rows);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function create(req, res) {
  try {
    const co = await changeOrderService.createChangeOrder({ ...req.body, companyId: req.companyId, requestedBy: req.auth.userId });
    res.status(201).json(co);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function get(req, res) {
  try { res.json(await changeOrderService.getChangeOrder(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function update(req, res) {
  try { res.json(await changeOrderService.updateChangeOrder(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function remove(req, res) {
  try { await changeOrderService.deleteChangeOrder(req.companyId, req.params.id); res.status(204).end(); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function approve(req, res) {
  try { res.json(await changeOrderService.approveChangeOrder(req.companyId, req.params.id, req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function reject(req, res) {
  try { res.json(await changeOrderService.rejectChangeOrder(req.companyId, req.params.id, req.auth.userId, req.body.reason)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { list, create, get, update, remove, approve, reject };
