const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/distributionController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('distribution'));

router.post('/price-schedules',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('tiers').isArray({ min: 1 }).withMessage('At least one tier is required.'),
  body('tiers.*.minQuantity').isFloat({ gt: 0 }).withMessage('Each tier needs a minQuantity greater than zero.'),
  body('tiers.*.unitPrice').isFloat({ min: 0 }).withMessage('Each tier needs a unitPrice.'),
  validate, controller.setSchedule);
router.get('/price-schedules', controller.listSchedules);
router.get('/price-schedules/:variantId', controller.getSchedule);

router.post('/quote',
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.variantId').isString().notEmpty().withMessage('Each item needs a variantId.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Each item needs a quantity greater than zero.'),
  validate, controller.quote);

router.post('/sales-orders',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  validate, controller.createOrder);

module.exports = router;
