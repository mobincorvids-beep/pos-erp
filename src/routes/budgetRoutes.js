const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_FINANCIAL } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/budgetController');

router.use(requireAuth, scopeToCompany);

router.post('/lines',
  requirePermission(REPORTS_FINANCIAL),
  body('accountId').isString().notEmpty().withMessage('accountId is required.'),
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be between 1 and 12.'),
  body('year').isInt({ min: 2000 }).withMessage('year is required.'),
  body('budgetedAmount').isFloat({ gt: 0 }).withMessage('budgetedAmount must be greater than zero.'),
  validate, controller.setBudget);
router.get('/lines', controller.listBudgetLines); // ?month=&year=
router.get('/vs-actual', requirePermission(REPORTS_FINANCIAL), controller.budgetVsActual); // ?month=&year=

module.exports = router;
