const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { WAREHOUSE_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/reorderRuleController');

router.use(requireAuth, scopeToCompany);

router.get('/rules', controller.listRules); // ?warehouseId=
router.post('/rules',
  requirePermission(WAREHOUSE_MANAGE),
  body('warehouseId').isMongoId().withMessage('warehouseId is required.'),
  body('productId').isMongoId().withMessage('productId is required.'),
  body('minQty').isFloat({ min: 0 }).withMessage('minQty must be a non-negative number.'),
  body('maxQty').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('maxQty must be a non-negative number.'),
  validate, controller.upsertRule);
router.delete('/rules/:id', requirePermission(WAREHOUSE_MANAGE), controller.deleteRule);

router.get('/below-reorder-point', controller.belowReorderPoint); // ?warehouseId=

module.exports = router;
