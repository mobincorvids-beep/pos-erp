const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_FINANCIAL } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/periodController');

router.use(requireAuth, scopeToCompany);

router.post('/fiscal-years',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date.'),
  validate, controller.createFiscalYear);
router.get('/fiscal-years', controller.listFiscalYears);
router.post('/periods',
  body('fiscalYearId').isString().notEmpty().withMessage('fiscalYearId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date.'),
  validate, controller.createAccountingPeriod);
router.get('/periods', controller.listAccountingPeriods);
router.post('/periods/:id/close', requirePermission(REPORTS_FINANCIAL), controller.closePeriod);
router.post('/periods/:id/reopen', requirePermission(REPORTS_FINANCIAL), controller.reopenPeriod);

module.exports = router;
