const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/giftRegistryController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('toys_gifts'));

router.post('/registries',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('ownerCustomerId').isString().notEmpty().withMessage('ownerCustomerId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.productId').isString().notEmpty().withMessage('Each item needs a productId.'),
  body('items.*.variantId').isString().notEmpty().withMessage('Each item needs a variantId.'),
  body('items.*.desiredQuantity').isFloat({ gt: 0 }).withMessage('Each item needs a desiredQuantity greater than zero.'),
  validate, controller.createRegistry);
router.get('/registries', controller.listRegistries); // ?ownerCustomerId=&status=
router.get('/registries/:id', controller.getRegistry);
router.post('/registries/:id/items/:itemId/purchase',
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  body('purchasingCustomerId').isString().notEmpty().withMessage('purchasingCustomerId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.purchaseFromRegistry);

module.exports = router;
