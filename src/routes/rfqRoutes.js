const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/rfqController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.productId').isString().notEmpty().withMessage('Each item needs a productId.'),
  body('items.*.variantId').isString().notEmpty().withMessage('Each item needs a variantId.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Each item needs a quantity greater than zero.'),
  validate, controller.createRFQ);
router.get('/', controller.listRFQs); // ?status=
router.post('/:id/quotations',
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one quoted item is required.'),
  validate, controller.submitQuotation);
router.get('/:id/quotations', controller.listQuotations);
router.get('/:id/compare', controller.compareQuotations);
router.post('/:id/convert-to-orders',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.convertBestPriceToOrders);

module.exports = router;
