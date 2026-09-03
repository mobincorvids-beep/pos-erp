const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SALES_VIEW, POS_SELL } = require('../constants/permissions');
const controller = require('../controllers/fbrComplianceController');

router.use(requireAuth, scopeToCompany);

router.get('/summary', requirePermission(SALES_VIEW), controller.summary);           // ?from=...&to=...
router.get('/outstanding', requirePermission(SALES_VIEW), controller.listOutstanding); // ?from=...&to=...&limit=...
router.post('/retry-all', requirePermission(POS_SELL), controller.retryAll);          // ?from=...&to=...

module.exports = router;
