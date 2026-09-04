const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PROJECT_TASKS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/projectBillingController');

router.use(requireAuth, scopeToCompany, requirePermission(PROJECT_TASKS_MANAGE));

router.get('/milestones', controller.listMilestones); // ?projectId=
router.post('/milestones',
  body('projectId').isString().notEmpty().withMessage('projectId is required.'),
  body('name').isString().notEmpty().withMessage('name is required.'),
  body('billingType').isIn(['fixed_amount', 'percent_of_contract']).withMessage('billingType must be fixed_amount or percent_of_contract.'),
  validate, controller.createMilestone);
router.post('/milestones/:id/complete', controller.completeMilestone);
router.post('/milestones/:id/bill',
  body('retentionPercent').optional().isFloat({ min: 0, max: 100 }),
  validate, controller.billMilestone);

router.get('/invoices', controller.listProjectInvoices); // ?projectId=
router.post('/invoices/:invoiceId/release-retention', controller.releaseRetention);
router.get('/retention/outstanding', controller.getOutstandingRetention); // ?projectId=

router.get('/:projectId/poc-revenue', controller.getPOCRevenue);

module.exports = router;
