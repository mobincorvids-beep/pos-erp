const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { LOGISTICS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/routeOptimizationController');

router.use(requireAuth, scopeToCompany, requirePermission(LOGISTICS_MANAGE));

// Sequences this vehicle's pending shipments from a depot location.
// Body: { depotLat, depotLng, date?, dryRun? } — dryRun previews without
// writing stopSequence back onto the shipments.
router.post('/vehicles/:vehicleId/optimize',
  body('depotLat').isFloat().withMessage('depotLat is required.'),
  body('depotLng').isFloat().withMessage('depotLng is required.'),
  validate, controller.optimizeVehicleRoute);

module.exports = router;
