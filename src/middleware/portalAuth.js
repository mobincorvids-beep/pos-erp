const jwt = require('jsonwebtoken');
const PortalUser = require('../models/PortalUser');

// A portal token is signed with { portal: true, portalUserId, customerId,
// companyId } — a distinctly different shape from a staff token
// ({ userId, companyId }). requireAuth (staff) never sets req.portalAuth,
// and this middleware never sets req.auth — the two are deliberately
// non-interchangeable so a portal login can never accidentally satisfy a
// staff-only route, or vice versa, even if someone tried to replay one
// token against the other's routes.
async function requirePortalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.portal) return res.status(401).json({ error: 'Not a portal token.' });

    const portalUser = await PortalUser.findById(payload.portalUserId);
    if (!portalUser || !portalUser.isActive) return res.status(401).json({ error: 'Invalid or inactive portal account.' });

    req.portalAuth = { portalUserId: portalUser._id, customerId: portalUser.customerId, companyId: portalUser.companyId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requirePortalAuth };
