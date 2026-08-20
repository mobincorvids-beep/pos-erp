const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ECOMMERCE_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/ecommerceConfigController');

router.use(requireAuth, scopeToCompany, requirePermission(ECOMMERCE_MANAGE));
router.get('/', controller.getConfig);
router.post('/enable', controller.enable); // { defaultBranchId, defaultWarehouseId, defaultPaymentAccountId } — also rotates the token if already enabled
router.post('/disable', controller.disable);

module.exports = router;
