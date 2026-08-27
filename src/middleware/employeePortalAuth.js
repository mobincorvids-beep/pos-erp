const jwt = require('jsonwebtoken');
const EmployeePortalUser = require('../models/EmployeePortalUser');

// An employee-portal token is signed with { employeePortal: true,
// employeePortalUserId, employeeId, companyId } — a distinctly different
// shape from both the staff token ({ userId, companyId }) and the
// customer-portal token ({ portal: true, ... }), so none of the three can
// be replayed against either of the other two's routes.
async function requireEmployeePortalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token.' });

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload.employeePortal) return res.status(401).json({ error: 'Not an employee portal token.' });

    const portalUser = await EmployeePortalUser.findById(payload.employeePortalUserId);
    if (!portalUser || !portalUser.isActive) return res.status(401).json({ error: 'Invalid or inactive portal account.' });

    req.employeePortalAuth = { employeePortalUserId: portalUser._id, employeeId: portalUser.employeeId, companyId: portalUser.companyId };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { requireEmployeePortalAuth };
