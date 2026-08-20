const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission, requireBranchAccess } = require('../middleware/auth');
const { INVENTORY_TRANSFER } = require('../constants/permissions');
const Warehouse = require('../models/Warehouse');
const controller = require('../controllers/transferController');

// A transfer's request body carries fromWarehouseId/toWarehouseId, not
// branchId directly — the default requireBranchAccess() extractor would
// find nothing here and silently no-op. This custom extractor resolves
// the SOURCE warehouse's own branchId first, so a user restricted to
// Branch A genuinely can't initiate a transfer moving stock OUT of a
// warehouse that belongs to Branch B, even though branchId itself never
// appears in the request.
async function extractBranchIdFromSourceWarehouse(req) {
  if (!req.body?.fromWarehouseId) return null;
  const warehouse = await Warehouse.findById(req.body.fromWarehouseId);
  return warehouse?.branchId || null;
}

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', requirePermission(INVENTORY_TRANSFER), requireBranchAccess(extractBranchIdFromSourceWarehouse), controller.initiate); // pass receiveImmediately:true to skip the in-transit step
router.post('/:id/receive', requirePermission(INVENTORY_TRANSFER), controller.receive);

module.exports = router;
