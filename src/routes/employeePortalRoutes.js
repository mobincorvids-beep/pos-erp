const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/employeePortalController');

// Staff-facing only — inviting an employee to the portal uses the normal
// internal auth. The employee's own login/dashboard/attendance/payslips/
// leave live under /api/employee-portal-session (see
// employeePortalSessionRoutes.js) with a completely separate auth guard.
router.use(requireAuth, scopeToCompany);

router.post('/invite',
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('email').isEmail().withMessage('A valid email is required.'),
  validate, controller.invite);

module.exports = router;
