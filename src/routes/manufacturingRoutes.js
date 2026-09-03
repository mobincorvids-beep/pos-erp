const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { MANUFACTURING_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/manufacturingController');

router.use(requireAuth, scopeToCompany);

router.get('/boms', controller.listBOMs);
router.post('/boms', requirePermission(MANUFACTURING_MANAGE), controller.createBOM);

router.get('/work-orders', controller.listWorkOrders); // ?status=planned|in_progress|completed|cancelled
router.post('/work-orders',
  requirePermission(MANUFACTURING_MANAGE),
  body('bomId').isString().notEmpty().withMessage('bomId is required.'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('quantityToProduce').isFloat({ gt: 0 }).withMessage('quantityToProduce must be greater than zero.'),
  body('routingId').optional().isString(),
  validate, controller.createWorkOrder);
router.post('/work-orders/:id/start', requirePermission(MANUFACTURING_MANAGE), controller.start);      // consumes raw materials; schedules operations if the WO has a routing
router.post('/work-orders/:id/complete',
  requirePermission(MANUFACTURING_MANAGE),
  body('quantityProduced').isFloat({ gt: 0 }).withMessage('quantityProduced must be greater than zero.'),
  body('scrapQuantity').optional().isFloat({ min: 0 }),
  body('actualConsumption').optional().isArray(),
  body('actualConsumption.*.productId').optional().isString(),
  body('actualConsumption.*.variantId').optional().isString(),
  body('actualConsumption.*.quantityActual').optional().isFloat({ min: 0 }),
  validate, controller.complete); // { quantityProduced, actualLaborCost?, actualOverheadCost?, wastageNote?, scrapQuantity?, actualConsumption?: [{productId,variantId,quantityActual}] } — backflush: omitted components default to their planned BOM quantity
router.post('/work-orders/:id/operations/:operationId',
  requirePermission(MANUFACTURING_MANAGE),
  body('actualHours').optional().isFloat({ min: 0 }),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed']),
  validate, controller.recordOperation); // { actualHours?, status? } — records actuals for a scheduled operation

// --- Work Centers ---
router.get('/work-centers', controller.listWorkCenters);
router.post('/work-centers',
  requirePermission(MANUFACTURING_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('capacityHoursPerDay').optional().isFloat({ gt: 0 }).withMessage('capacityHoursPerDay must be greater than zero.'),
  validate, controller.createWorkCenter);
router.put('/work-centers/:id', requirePermission(MANUFACTURING_MANAGE), controller.updateWorkCenter);

// --- Routings ---
router.get('/routings', controller.listRoutings); // ?bomId=
router.post('/routings',
  requirePermission(MANUFACTURING_MANAGE),
  body('bomId').isString().notEmpty().withMessage('bomId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('operations').isArray({ min: 1 }).withMessage('At least one operation is required.'),
  body('operations.*.sequence').isInt({ min: 1 }).withMessage('Each operation needs a sequence number.'),
  body('operations.*.workCenterId').isString().notEmpty().withMessage('Each operation needs a workCenterId.'),
  body('operations.*.operationName').isString().trim().notEmpty().withMessage('Each operation needs an operationName.'),
  body('operations.*.estimatedHours').isFloat({ gt: 0 }).withMessage('Each operation needs estimatedHours greater than zero.'),
  validate, controller.createRouting);

// --- MRP ---
router.get('/mrp-runs', controller.listMrpRuns);
router.get('/mrp-runs/:id', controller.getMrpRun);
router.post('/mrp-runs',
  requirePermission(MANUFACTURING_MANAGE),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('demand').optional().isArray(),
  body('demand.*.productId').optional().isString(),
  body('demand.*.variantId').optional().isString(),
  body('demand.*.quantity').optional().isFloat({ gt: 0 }),
  body('includeReorderLevel').optional().isBoolean(),
  validate, controller.runMrp); // { warehouseId, branchId, demand?: [{productId,variantId,quantity}], includeReorderLevel? }
router.post('/mrp-runs/:id/suggested-purchases/:lineId/convert',
  requirePermission(MANUFACTURING_MANAGE),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('unitCost').optional().isFloat({ min: 0 }),
  validate, controller.convertPurchaseLine);
router.post('/mrp-runs/:id/suggested-work-orders/:lineId/convert', requirePermission(MANUFACTURING_MANAGE), controller.convertWorkOrderLine);

// --- Reporting ---
router.get('/reports/efficiency', controller.efficiencyReport); // ?warehouseId=&from=&to=
router.get('/reports/cost-variance', controller.costVarianceReport); // ?warehouseId=&from=&to= — actual vs BOM-standard cost per completed work order

module.exports = router;
