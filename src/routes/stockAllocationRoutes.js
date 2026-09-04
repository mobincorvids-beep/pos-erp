const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SALES_ORDER_CONVERT } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/stockAllocationController');

router.use(requireAuth, scopeToCompany);

router.get('/rules', controller.listRules);

// ?productId=&variantId=&warehouseId=&rule= — read-only preview of who gets what.
router.get('/plan', controller.plan);

router.post('/apply',
  requirePermission(SALES_ORDER_CONVERT),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('rule').optional().isString(),
  validate, controller.apply);

module.exports = router;
