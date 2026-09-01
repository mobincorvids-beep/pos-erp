const jwt = require('jsonwebtoken');
const SupplierPortalUser = require('../models/SupplierPortalUser');

// A supplier-portal token is signed with { supplierPortal: true,
// supplierPortalUserId, supplierId, companyId } — a distinct namespace
// from both the staff token ({ userId, companyId }) and the customer
// portal token ({ portal: true, ... }). This middleware only ever sets
// req.supplierPortalAuth, never req.auth or req.portalAuth, so none of
// the three session types can be replayed against another's routes.
async function requireSupplierPortalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.supplierPortal) return res.status(401).json({ error: 'Not a supplier portal token.' });

    const portalUser = await SupplierPortalUser.findById(payload.supplierPortalUserId);
    if (!portalUser || !portalUser.isActive) return res.status(401).json({ error: 'Invalid or inactive portal account.' });

    req.supplierPortalAuth = { supplierPortalUserId: portalUser._id, supplierId: portalUser.supplierId, companyId: portalUser.companyId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requireSupplierPortalAuth };
