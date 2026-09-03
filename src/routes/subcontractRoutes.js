const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SUBCONTRACTING_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/subcontractController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?status=&supplierId=
router.get('/:id', controller.get);
router.post('/',
  requirePermission(SUBCONTRACTING_MANAGE),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('itemsSent').isArray({ min: 1 }).withMessage('At least one item sent is required.'),
  body('itemsSent.*.productId').isString().notEmpty(),
  body('itemsSent.*.variantId').isString().notEmpty(),
  body('itemsSent.*.quantity').isFloat({ gt: 0 }),
  body('sentDate').optional().isISO8601(),
  validate, controller.create);
router.post('/:id/receive',
  requirePermission(SUBCONTRACTING_MANAGE),
  body('items').isArray({ min: 1 }).withMessage('At least one received item is required.'),
  body('items.*.productId').isString().notEmpty(),
  body('items.*.variantId').isString().notEmpty(),
  body('items.*.quantity').isFloat({ gt: 0 }),
  validate, controller.receive);
router.post('/:id/close', requirePermission(SUBCONTRACTING_MANAGE), controller.close);

module.exports = router;
