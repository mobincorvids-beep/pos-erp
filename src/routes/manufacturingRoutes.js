const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { MANUFACTURING_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/manufacturingController');

router.use(requireAuth, scopeToCompany);

router.get('/boms', controller.listBOMs);
router.post('/boms', requirePermission(MANUFACTURING_MANAGE), controller.createBOM);

router.get('/work-orders', controller.listWorkOrders); // ?status=planned|in_progress|completed|cancelled
router.post('/work-orders', requirePermission(MANUFACTURING_MANAGE), controller.createWorkOrder);
router.post('/work-orders/:id/start', requirePermission(MANUFACTURING_MANAGE), controller.start);      // consumes raw materials
router.post('/work-orders/:id/complete', requirePermission(MANUFACTURING_MANAGE), controller.complete); // { quantityProduced, actualLaborCost?, actualOverheadCost?, wastageNote? }

module.exports = router;
