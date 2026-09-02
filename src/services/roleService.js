/**
 * RoleService — seeds the starter role catalog (Admin/Manager/Accountant/
 * Cashier/HR/Warehouse staff) for a company. Mirrors the auto-heal pattern
 * categoryService uses: ensureStarterRoles() is safe to call repeatedly and
 * only seeds when a company genuinely has zero roles, so it can be called
 * both at onboarding time and lazily (roleController.list) to backfill any
 * company that was provisioned before this existed — no manual migration
 * or button click needed for existing tenants.
 */
const Role = require('../models/Role');
const { STARTER_ROLE_TEMPLATES } = require('../constants/roleTemplates');

async function ensureStarterRoles(companyId) {
  const existingCount = await Role.countDocuments({ companyId });
  if (existingCount > 0) return [];

  const docs = STARTER_ROLE_TEMPLATES.map((template) => ({
    companyId,
    name: template.name,
    permissions: template.permissions,
  }));
  return Role.insertMany(docs);
}

module.exports = { ensureStarterRoles };
