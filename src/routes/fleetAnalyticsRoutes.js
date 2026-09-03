// NOT wired into src/routes/index.js yet — mount with:
//   router.use('/fleet', require('./fleetAnalyticsRoutes'));
// alongside the existing router.use('/fleet', require('./fleetRoutes')); line.
// Both routers mount at the same '/fleet' prefix and own disjoint paths
// (fuel-efficiency-report, freight-rate, quote-freight), so mounting both
// under '/fleet' is safe.
const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/fleetAnalyticsController');

router.use(requireAuth, scopeToCompany);

// GET /fleet/fuel-efficiency-report?from=&to=&thresholdPct=
router.get('/fuel-efficiency-report', controller.fuelEfficiencyReport);

// GET /fleet/freight-rate — the single active rate card
router.get('/freight-rate', controller.getActiveFreightRate);
// GET /fleet/freight-rates — full history
router.get('/freight-rates', controller.listFreightRates);
// POST /fleet/freight-rate — set a new active rate card (config, so gated like other fleet.manage writes)
router.post('/freight-rate',
  body('ratePerKm').isFloat({ min: 0 }).withMessage('ratePerKm is required and must be >= 0.'),
  validate, requirePermission('fleet.manage'), controller.setFreightRate);

// POST /fleet/quote-freight — read-only computation, callable when creating a sales order/delivery
router.post('/quote-freight',
  body('distanceKm').isFloat({ gt: 0 }).withMessage('distanceKm is required and must be greater than zero.'),
  validate, controller.quoteFreight);

module.exports = router;
