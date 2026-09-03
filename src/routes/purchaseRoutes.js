const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission, requireBranchAccess } = require('../middleware/auth');
const { PURCHASE_CREATE, PURCHASE_RECEIVE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/purchaseController');

const createValidation = [
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.productId').isString().notEmpty().withMessage('Each item needs a productId.'),
  body('items.*.variantId').isString().notEmpty().withMessage('Each item needs a variantId.'),
  body('items.*.quantityOrdered').isFloat({ gt: 0 }).withMessage('quantityOrdered must be greater than zero.'),
  body('items.*.unitCost').isFloat({ min: 0 }).withMessage('unitCost cannot be negative.'),
];

const receiveValidation = [
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.purchaseOrderItemId').isString().notEmpty().withMessage('Each item needs a purchaseOrderItemId.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Received quantity must be greater than zero.'),
];

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', requirePermission(PURCHASE_CREATE), requireBranchAccess(), createValidation, validate, controller.createOrder); // creates as 'draft'
router.post('/from-alternate-units', requirePermission(PURCHASE_CREATE), requireBranchAccess(),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.productId').isString().notEmpty().withMessage('Each item needs a productId.'),
  body('items.*.variantId').isString().notEmpty().withMessage('Each item needs a variantId.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  body('items.*.unitCost').isFloat({ min: 0 }).withMessage('unitCost cannot be negative.'),
  body('items.*.purchaseUnitId').isString().notEmpty().withMessage('purchaseUnitId is required — which unit this line item was actually purchased in.'),
  validate, controller.createOrderFromAlternateUnits);
router.get('/:id', controller.get);
router.post('/:id/decide', requirePermission(PURCHASE_CREATE), body('approve').isBoolean().withMessage('approve must be true or false.'), validate, controller.decide);
router.post('/:id/receive', requirePermission(PURCHASE_RECEIVE), receiveValidation, validate, controller.receive);
router.get('/:id/grns', requirePermission(PURCHASE_RECEIVE), controller.listGRNs);
router.post('/grn/:grnId/items/:itemId/qc', requirePermission(PURCHASE_RECEIVE), body('passed').isBoolean().withMessage('passed must be true or false.'), validate, controller.recordQC);
router.put('/grn/:grnId/items/:itemId/bin-location', requirePermission(PURCHASE_RECEIVE), body('binLocation').optional().isString().withMessage('binLocation must be a string.'), validate, controller.setBinLocation);

const landedCostValidation = [
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  body('amount').isFloat({ min: 0 }).withMessage('amount cannot be negative.'),
  body('allocationMethod').optional().isIn(['by_value', 'by_quantity']).withMessage('allocationMethod must be "by_value" or "by_quantity".'),
];
const landedCostUpdateValidation = [
  body('description').optional().isString().trim().notEmpty().withMessage('description cannot be empty.'),
  body('amount').optional().isFloat({ min: 0 }).withMessage('amount cannot be negative.'),
  body('allocationMethod').optional().isIn(['by_value', 'by_quantity']).withMessage('allocationMethod must be "by_value" or "by_quantity".'),
];
// Landed costs (freight/customs/insurance/handling) are PO-level cost
// configuration, not the physical act of receiving goods — gated behind
// PURCHASE_CREATE, same as the rest of a PO's editable content, and usable
// any time before the PO is cancelled (see purchaseService for the exact
// status guard).
router.post('/:id/landed-costs', requirePermission(PURCHASE_CREATE), landedCostValidation, validate, controller.addLandedCost);
router.put('/:id/landed-costs/:costId', requirePermission(PURCHASE_CREATE), landedCostUpdateValidation, validate, controller.updateLandedCost);
router.delete('/:id/landed-costs/:costId', requirePermission(PURCHASE_CREATE), controller.removeLandedCost);

module.exports = router;
