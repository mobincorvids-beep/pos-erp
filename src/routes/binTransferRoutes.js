const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { WAREHOUSE_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/binTransferController');

// NOT wired into src/routes/index.js yet — see the report accompanying this
// file for the exact `app.use('/bin-transfers', require('./binTransferRoutes'))`
// line to add.

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?warehouseId=&status=pending|approved|completed|rejected
router.get('/:id', controller.get);

router.post('/',
  requirePermission(WAREHOUSE_MANAGE),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('fromBinId').isString().notEmpty().withMessage('fromBinId is required.'),
  body('toBinId').isString().notEmpty().withMessage('toBinId is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').optional().isString(),
  body('batchId').optional().isString(),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  body('note').optional().isString(),
  validate, controller.request);

router.post('/:id/approve', requirePermission(WAREHOUSE_MANAGE), controller.approve);
router.post('/:id/reject',
  requirePermission(WAREHOUSE_MANAGE),
  body('reason').optional().isString(),
  validate, controller.reject);
router.post('/:id/complete', requirePermission(WAREHOUSE_MANAGE), controller.complete);

module.exports = router;
