const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/recurringInvoiceController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('frequency').isIn(['weekly', 'monthly', 'quarterly', 'annually']).withMessage('Invalid frequency.'),
  validate, controller.createTemplate);
router.get('/', controller.listTemplates); // ?status=&customerId=
router.post('/:id/pause', controller.pauseTemplate);
router.post('/:id/resume', controller.resumeTemplate);
router.post('/:id/cancel', controller.cancelTemplate);
router.post('/generate-due',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.generateDueInvoices);

module.exports = router;
