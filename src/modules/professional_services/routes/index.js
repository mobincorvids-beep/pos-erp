const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/timeEntryController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('professional_services'));

router.post('/time-entries',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('clientCustomerId').isString().notEmpty().withMessage('clientCustomerId is required.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  body('hours').isFloat({ gt: 0 }).withMessage('hours must be greater than zero.'),
  body('hourlyRate').isFloat({ gt: 0 }).withMessage('hourlyRate must be greater than zero.'),
  validate, controller.logTime);
router.get('/time-entries/unbilled', controller.listUnbilledEntries); // ?clientCustomerId=
router.get('/time-entries/invoiced', controller.listInvoicedEntries); // ?clientCustomerId=&saleId=
router.post('/clients/:clientCustomerId/generate-invoice',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.generateInvoice);

module.exports = router;
