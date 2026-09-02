const Role = require('../models/Role');
const User = require('../models/User');
const { CATALOG } = require('../constants/permissions');
const roleService = require('../services/roleService');

function permissionsCatalog(req, res) {
  res.json(CATALOG);
}

async function list(req, res) {
  // Auto-heals any company with zero roles (new tenants going forward get
  // these at onboarding time already; this backfills every company that
  // existed before starter roles did, retroactively, with no manual step).
  await roleService.ensureStarterRoles(req.companyId);
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

/** Refuses to delete a role that's still assigned to someone — same
 * "in use" guard the codebase already applies elsewhere (e.g. Branch
 * can't be deactivated if it's the company's only one) rather than
 * silently leaving those users with a dangling roleId. */
async function remove(req, res) {
  const assignedCount = await User.countDocuments({ companyId: req.companyId, roleId: req.params.id });
  if (assignedCount > 0) {
    return res.status(400).json({ error: `This role is still assigned to ${assignedCount} user(s). Reassign them to a different role first.` });
  }
  const role = await Role.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
  if (!role) return res.status(404).json({ error: 'Role not found.' });
  res.json({ ok: true });
}

module.exports = { list, create, update, remove, permissionsCatalog };
