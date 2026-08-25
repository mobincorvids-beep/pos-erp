const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/importShipmentController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('import_export'));

router.post('/shipments',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.productId').isString().notEmpty().withMessage('Each item needs a productId.'),
  body('items.*.variantId').isString().notEmpty().withMessage('Each item needs a variantId.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Each item needs a quantity greater than zero.'),
  body('items.*.unitPrice').isFloat({ gt: 0 }).withMessage('Each item needs a unitPrice greater than zero.'),
  validate, controller.createShipment);
router.get('/shipments', controller.listShipments); // ?status=
router.put('/shipments/:id',
  body('items').optional().isArray({ min: 1 }).withMessage('At least one item is required.'),
  validate, controller.updateShipment);
router.delete('/shipments/:id', controller.cancelShipment);
router.post('/shipments/:id/receive',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('inventoryAssetAccountId').isString().notEmpty().withMessage('inventoryAssetAccountId is required.'),
  body('supplierPayableAccountId').isString().notEmpty().withMessage('supplierPayableAccountId is required.'),
  validate, controller.receiveShipment);

module.exports = router;
