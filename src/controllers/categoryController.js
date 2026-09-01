const categoryService = require('../services/categoryService');

async function list(req, res) {
  res.json(await categoryService.list(req.companyId));
}

async function tree(req, res) {
  res.json(await categoryService.getTree(req.companyId));
}

async function create(req, res) {
  try {
    const category = await categoryService.create(req.companyId, req.body);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const category = await categoryService.update(req.companyId, req.params.id, req.body);
    res.json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function remove(req, res) {
  try {
    await categoryService.remove(req.companyId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** Idempotent "pull in the defaults" action for an existing company: matches by name, skips what's already there. */
async function reseedDefaults(req, res) {
  const result = await categoryService.seedDefaultCategories(req.companyId);
  res.json({ ok: true, ...result });
}

module.exports = { list, tree, create, update, remove, reseedDefaults };
