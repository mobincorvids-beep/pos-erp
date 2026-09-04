const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { WAREHOUSE_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/drpController');

router.use(requireAuth, scopeToCompany);

// ?dcWarehouseId= — a warehouse of type distribution_center. Returns
// suggested branch transfers; converting one into a real movement still
// goes through the existing POST /stock-transfers or /bin-transfers flow.
router.get('/suggested-transfers', requirePermission(WAREHOUSE_MANAGE), controller.suggestTransfers);

module.exports = router;
