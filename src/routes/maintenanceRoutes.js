const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/maintenanceController');

router.use(requireAuth, scopeToCompany);

router.get('/plans', controller.listPlans); // ?assetId=&dueOnly=true
router.post('/plans',
  body('assetId').isString().notEmpty().withMessage('assetId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('frequencyDays').isInt({ gt: 0 }).withMessage('frequencyDays must be greater than zero.'),
  validate, controller.createPlan);
router.put('/plans/:id',
  body('frequencyDays').optional().isInt({ gt: 0 }).withMessage('frequencyDays must be greater than zero.'),
  validate, controller.updatePlan);

router.get('/work-orders', controller.listWorkOrders); // ?assetId=&status=
router.post('/work-orders',
  body('assetId').isString().notEmpty().withMessage('assetId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('issue').isString().trim().notEmpty().withMessage('issue is required.'),
  validate, controller.openWorkOrder);
router.post('/work-orders/:id/complete', controller.completeWorkOrder);
router.post('/work-orders/:id/cancel', controller.cancelWorkOrder);

router.get('/assets/:assetId/history', controller.assetMaintenanceHistory);

module.exports = router;
