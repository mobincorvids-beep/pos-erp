const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/societyController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('housing_society'));

router.post('/charges',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.createCharge);
router.get('/charges', controller.listCharges);
router.post('/members',
  body('propertyId').isString().notEmpty().withMessage('propertyId is required.'),
  body('residentCustomerId').isString().notEmpty().withMessage('residentCustomerId is required.'),
  validate, controller.enrollMember);
router.get('/members', controller.listMembers);
router.post('/invoices/generate',
  body('chargeId').isString().notEmpty().withMessage('chargeId is required.'),
  body('period').isString().trim().notEmpty().withMessage('period is required.'),
  body('dueDate').isISO8601().withMessage('dueDate must be a valid date.'),
  validate, controller.generateInvoices);
router.get('/invoices', controller.listInvoices); // ?propertyId=&residentCustomerId=&status=&period=
router.post('/invoices/:id/pay',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.payInvoice);
router.post('/complaints',
  body('propertyId').isString().notEmpty().withMessage('propertyId is required.'),
  body('residentCustomerId').isString().notEmpty().withMessage('residentCustomerId is required.'),
  body('category').isString().trim().notEmpty().withMessage('category is required.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  validate, controller.submitComplaint);
router.post('/complaints/:id/assign', body('assignedToUserId').isString().notEmpty().withMessage('assignedToUserId is required.'), validate, controller.assignComplaint);
router.post('/complaints/:id/resolve', body('resolutionNote').isString().trim().notEmpty().withMessage('resolutionNote is required.'), validate, controller.resolveComplaint);
router.get('/complaints', controller.listComplaints); // ?propertyId=&status=

module.exports = router;
