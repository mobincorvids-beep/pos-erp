const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_VIEW, INVENTORY_ADJUST } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/demandForecastController');

router.use(requireAuth, scopeToCompany);

// ?productId=&variantId=&warehouseId=&historyDays=&forecastDays=
router.get('/forecast', requirePermission(REPORTS_VIEW), controller.forecast);
// ?productId=&variantId=&warehouseId=&serviceLevel=&leadTimeDays=&historyDays=
router.get('/safety-stock', requirePermission(REPORTS_VIEW), controller.safetyStock);

router.post('/safety-stock/apply',
  requirePermission(INVENTORY_ADJUST),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('safetyStockQty').isFloat({ min: 0 }).withMessage('safetyStockQty must be zero or greater.'),
  validate, controller.applySafetyStock);

module.exports = router;
