const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/leaseController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('real_estate'));

router.post('/properties',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('unitNumber').isString().trim().notEmpty().withMessage('unitNumber is required.'),
  body('propertyType').isString().trim().notEmpty().withMessage('propertyType is required.'),
  validate, controller.createProperty);
router.get('/properties', controller.listProperties); // ?status=
router.post('/leases',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('propertyId').isString().notEmpty().withMessage('propertyId is required.'),
  body('tenantCustomerId').isString().notEmpty().withMessage('tenantCustomerId is required.'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date.'),
  body('monthlyRent').isFloat({ gt: 0 }).withMessage('monthlyRent must be greater than zero.'),
  validate, controller.startLease);
router.get('/leases', controller.listLeases); // ?propertyId=&status=
router.post('/leases/:id/generate-rent',
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.generateRentInvoice);
router.post('/leases/:id/end', controller.endLease);

module.exports = router;
