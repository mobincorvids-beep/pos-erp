const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_VIEW } = require('../constants/permissions');
const controller = require('../controllers/aiInsightsController');

router.use(requireAuth, scopeToCompany, requirePermission(REPORTS_VIEW));
router.get('/briefing', controller.briefing);
router.get('/reorder-recommendations', controller.reorderRecommendations); // ?warehouseId=
router.get('/slow-moving-inventory', controller.slowMoving);                // ?days=&warehouseId=
router.get('/sales-anomalies', controller.salesAnomalies);                  // ?thresholdPercent=

module.exports = router;
