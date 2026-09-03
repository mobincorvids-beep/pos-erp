const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { INVENTORY_WRITE_OFF } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/inventoryAgingController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.getAging); // ?warehouseId=
router.post('/write-off',
  requirePermission(INVENTORY_WRITE_OFF),
  body('productId').isMongoId().withMessage('productId is required.'),
  body('variantId').isMongoId().withMessage('variantId is required.'),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  body('reason').isString().trim().notEmpty().withMessage('reason is required.'),
  validate, controller.writeOff);

module.exports = router;
