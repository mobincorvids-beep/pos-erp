const Role = require('../models/Role');
const { CATALOG } = require('../constants/permissions');

function permissionsCatalog(req, res) {
  res.json(CATALOG);
}

async function list(req, res) {
  const roles = await Role.find({ companyId: req.companyId });
  res.json(roles);
}

async function create(req, res) {
  try {
    const { name, permissions } = req.body;
    if (!name) throw new Error('Role name is required.');
    const role = await Role.create({ companyId: req.companyId, name, permissions: permissions || [] });
    res.status(201).json(role);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  const role = await Role.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { name: req.body.name, permissions: req.body.permissions },
    { new: true }
  );
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  res.json(role);
}

module.exports = { list, create, update, permissionsCatalog };
