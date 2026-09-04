const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { WAREHOUSE_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/licensePlateController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?warehouseId=&binId=&status=open|closed|shipped|consumed
router.get('/:id', controller.get);

router.post('/',
  requirePermission(WAREHOUSE_MANAGE),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('binId').isString().notEmpty().withMessage('binId is required.'),
  body('code').optional().isString(),
  validate, controller.create);

router.post('/:id/items',
  requirePermission(WAREHOUSE_MANAGE),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').optional().isString(),
  body('batchId').optional().isString(),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  validate, controller.addItem);

router.post('/:id/move',
  requirePermission(WAREHOUSE_MANAGE),
  body('toBinId').isString().notEmpty().withMessage('toBinId is required.'),
  validate, controller.move);

router.post('/:id/close', requirePermission(WAREHOUSE_MANAGE), controller.close);
router.post('/:id/ship', requirePermission(WAREHOUSE_MANAGE), controller.ship);

module.exports = router;
