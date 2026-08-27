const taskService = require('../services/taskService');

async function create(req, res) {
  try {
    const task = await taskService.createTask({ ...req.body, companyId: req.companyId, createdBy: req.auth.userId });
    res.status(201).json(task);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function list(req, res) {
  try { res.json(await taskService.listTasks(req.companyId, req.query.projectId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function updateStatus(req, res) {
  try { res.json(await taskService.updateTaskStatus(req.companyId, req.params.id, req.body.status)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function update(req, res) {
  try { res.json(await taskService.updateTask(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function remove(req, res) {
  try { await taskService.deleteTask(req.companyId, req.params.id); res.status(204).end(); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { create, list, updateStatus, update, remove };
