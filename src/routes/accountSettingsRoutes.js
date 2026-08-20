const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ACCOUNTS_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/accountSettingsController');

router.use(requireAuth, scopeToCompany, requirePermission(ACCOUNTS_MANAGE));
router.get('/', controller.get);
router.put('/', controller.update); // { inventoryAssetId?, costOfGoodsSoldId?, accountsReceivableId?, accountsPayableId?, salariesExpenseId?, salesTaxPayableId?, salesRevenueId? }

module.exports = router;
