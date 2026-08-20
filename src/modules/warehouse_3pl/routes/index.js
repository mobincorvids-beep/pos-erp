const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/storageContractController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('warehouse_3pl'));

router.post('/contracts',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('clientCustomerId').isString().notEmpty().withMessage('clientCustomerId is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('ratePerUnitPerDay').isFloat({ gt: 0 }).withMessage('ratePerUnitPerDay must be greater than zero.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.createContract);
router.get('/contracts', controller.listContracts);
router.post('/contracts/:id/receive', body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'), validate, controller.receiveGoods);
router.post('/contracts/:id/release', body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'), validate, controller.releaseGoods);
router.get('/contracts/:id/fee', controller.computeStorageFee); // ?periodStart=&periodEnd=
router.post('/contracts/:id/bill', body('periodStart').isISO8601().withMessage('periodStart is required.'), body('periodEnd').isISO8601().withMessage('periodEnd is required.'), validate, controller.billPeriod);

module.exports = router;
