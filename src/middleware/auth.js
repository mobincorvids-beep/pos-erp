const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Role = require('../models/Role');

/** Verifies JWT and attaches { userId, companyId, roleId, permissions } to req.auth. */
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.userId);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid or inactive user.' });

    // A user with no roleId is treated as the company owner/super-admin —
    // this is deliberate (someone has to be able to act before any roles
    // are configured) and matches how the seed script creates the admin.
    // Everyone else's access is exactly what their Role.permissions lists.
    let permissions = null; // null = unrestricted (super-admin)
    if (user.roleId) {
      const role = await Role.findById(user.roleId);
      permissions = role?.permissions || [];
    }

    req.auth = {
      userId: user._id, companyId: user.companyId, branchId: user.branchId,
      roleId: user.roleId, permissions,
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/** Ensures every query in this request is scoped to the caller's own company (multi-tenant isolation). */
function scopeToCompany(req, res, next) {
  if (!req.auth?.companyId) return res.status(401).json({ error: 'Unauthenticated.' });
  req.companyId = req.auth.companyId;
  next();
}

/**
 * Gates a route behind a permission key (e.g. 'expenses.approve', 'pos.sell').
 * A user with permissions === null (no role assigned) always passes — see
 * the super-admin note in requireAuth. A role's permissions array can also
 * include a module wildcard ('expenses.*') or global wildcard ('*').
 *
 * Usage: router.post('/:id/approve', requireAuth, scopeToCompany, requirePermission('expenses.approve'), controller.approve)
 */
function requirePermission(key) {
  const [module] = key.split('.');
  return (req, res, next) => {
    const permissions = req.auth?.permissions;
    if (permissions === null || permissions === undefined) return next(); // super-admin
    const allowed = permissions.includes(key) || permissions.includes(`${module}.*`) || permissions.includes('*');
    if (!allowed) return res.status(403).json({ error: `Missing permission: ${key}` });
    next();
  };
}

/**
 * The same authorization logic requirePermission() already uses,
 * extracted as a plain boolean check — for the real cases where a route
 * needs a CONDITIONAL permission (e.g., a stricter check only when the
 * request body targets a specific, more sensitive entity type), which a
 * static route-level requirePermission() can't express since it only
 * ever checks one fixed key regardless of the request body.
 */
function hasPermission(req, key) {
  const [module] = key.split('.');
  const permissions = req.auth?.permissions;
  if (permissions === null || permissions === undefined) return true; // super-admin
  return permissions.includes(key) || permissions.includes(`${module}.*`) || permissions.includes('*');
}

/**
 * Gates a route behind branch-level access — the actual enforcement that
 * was missing. `req.auth.branchId` was already being set on login and put
 * in the JWT, but nothing anywhere ever checked it against the branch a
 * request was actually operating on; a cashier assigned to Branch A could
 * act on Branch B's sales, purchases, or inventory freely as long as they
 * were in the same company. This closes that gap.
 *
 * Same escape hatches requirePermission() already established, applied
 * consistently rather than inventing new rules: a super-admin
 * (permissions === null) always passes, and a role with the
 * 'org.all_branches' permission (or the global '*' wildcard) is
 * deliberately unrestricted — a company-wide accountant or owner needs to
 * see every branch, not be locked to one. A user with NO branchId
 * assigned at all (most non-branch-specific roles) is also unrestricted —
 * branchId is an opt-in restriction, not a default-deny.
 *
 * `extractBranchId` is optional — defaults to checking
 * body/params/query.branchId, which covers every CREATE-style route where
 * the caller supplies which branch a new document belongs to. Routes that
 * act on an EXISTING document by :id (approve, receive, cancel...) need a
 * custom extractor that looks the document's own branchId up from the DB
 * first — NOT every such route has one wired in yet; this is an honest,
 * partial rollout to the highest-value create-time paths (POS checkout,
 * purchase order creation, stock transfers, banking), not a claim of
 * total coverage everywhere a branchId could theoretically matter.
 *
 * Usage: router.post('/', requireAuth, scopeToCompany, requireBranchAccess(), controller.checkout)
 * Usage with a custom lookup: requireBranchAccess(async (req) => { const doc = await Model.findById(req.params.id); return doc?.branchId; })
 */
function requireBranchAccess(extractBranchId) {
  return async (req, res, next) => {
    try {
      const permissions = req.auth?.permissions;
      if (permissions === null || permissions === undefined) return next(); // super-admin
      if (permissions.includes('org.all_branches') || permissions.includes('*')) return next();
      if (!req.auth?.branchId) return next(); // this user isn't restricted to any specific branch

      const requestedBranchId = extractBranchId
        ? await extractBranchId(req)
        : (req.body?.branchId || req.params?.branchId || req.query?.branchId);

      if (!requestedBranchId) return next(); // nothing to check against in this request — can't restrict what isn't scoped

      if (String(requestedBranchId) !== String(req.auth.branchId)) {
        return res.status(403).json({ error: 'You do not have access to this branch.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { requireAuth, scopeToCompany, requirePermission, hasPermission, requireBranchAccess };
