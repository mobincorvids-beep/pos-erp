const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/portalController');

// Staff-facing only — inviting a customer to the portal uses the normal
// internal auth. The customer's own login/dashboard/invoices/tickets
// live under /api/portal-session (see portalSessionRoutes.js) with a
// completely separate auth guard.
router.use(requireAuth, scopeToCompany);

router.post('/invite',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('email').isEmail().withMessage('A valid email is required.'),
  validate, controller.invite);

module.exports = router;
