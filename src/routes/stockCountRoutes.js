const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission, requireBranchAccess } = require('../middleware/auth');
const { INVENTORY_ADJUST } = require('../constants/permissions');
const Warehouse = require('../models/Warehouse');
const controller = require('../controllers/stockCountController');

// Same reasoning as transferRoutes.js — warehouseId is in the request, not
// branchId directly, so this resolves through the actual Warehouse
// document rather than silently no-op-ing.
async function extractBranchIdFromWarehouse(req) {
  if (!req.body?.warehouseId) return null;
  const warehouse = await Warehouse.findById(req.body.warehouseId);
  return warehouse?.branchId || null;
}

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requirePermission(INVENTORY_ADJUST), requireBranchAccess(extractBranchIdFromWarehouse), controller.start);           // { warehouseId, variantIds? }
router.patch('/:id/counts', requirePermission(INVENTORY_ADJUST), controller.recordCounts); // { counts: [{ itemId, countedQuantity }] }
router.post('/:id/submit', requirePermission(INVENTORY_ADJUST), controller.submit);
router.delete('/:id', requirePermission(INVENTORY_ADJUST), controller.remove); // only while in_progress — see stockCountService.deleteCount
router.delete('/:id/items/:itemId', requirePermission(INVENTORY_ADJUST), controller.removeItem);

module.exports = router;
