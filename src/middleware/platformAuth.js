const jwt = require('jsonwebtoken');
const PlatformAdmin = require('../models/PlatformAdmin');

/**
 * Platform-admin tokens carry { type: 'platform_admin' } so they can never
 * be confused with (or accidentally accepted as) a tenant user's token, and
 * vice versa — requireAuth (tenant) and requirePlatformAdmin each check for
 * their own JWT payload shape, effectively two separate auth namespaces
 * sharing one JWT_SECRET.
 */
async function requirePlatformAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.type !== 'platform_admin') return res.status(401).json({ error: 'Not a platform-admin token.' });

    const admin = await PlatformAdmin.findById(payload.adminId);
    if (!admin || !admin.isActive) return res.status(401).json({ error: 'Invalid or inactive admin account.' });

    req.platformAdmin = { adminId: admin._id, role: admin.role };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

/** Support-role admins can view but not perform destructive/mutating actions on tenants. */
function requireAdminRole(req, res, next) {
  if (req.platformAdmin?.role !== 'admin') {
    return res.status(403).json({ error: 'This action requires the admin role (support is read-only).' });
  }
  next();
}

module.exports = { requirePlatformAdmin, requireAdminRole };
