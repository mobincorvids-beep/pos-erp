const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/dailyBatchController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('bakery'));

router.post('/batches',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('producedQuantity').isFloat({ gt: 0 }).withMessage('producedQuantity must be greater than zero.'),
  validate, controller.produceBatch);
router.get('/batches', controller.listBatches); // ?status=&warehouseId=
router.post('/batches/:id/close', controller.closeBatch);

module.exports = router;
