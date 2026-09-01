const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/supplierPortalController');

// Staff-facing only — inviting a supplier to the portal uses the normal
// internal auth. The supplier's own login/dashboard/orders/payments live
// under /api/supplier-portal-session (see supplierPortalSessionRoutes.js)
// with a completely separate auth guard.
router.use(requireAuth, scopeToCompany);

router.post('/invite',
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('email').isEmail().withMessage('A valid email is required.'),
  validate, controller.invite);

module.exports = router;
