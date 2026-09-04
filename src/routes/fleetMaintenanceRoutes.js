const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { FLEET_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/fleetMaintenanceController');

router.use(requireAuth, scopeToCompany);

router.get('/schedules', controller.listSchedules); // ?vehicleId=&isActive=
router.get('/schedules/due', controller.getDueMaintenanceSchedules); // ?withinDays=&notify=true
router.get('/compliance/expiring', controller.getExpiringVehicleCompliance); // ?withinDays=

router.post('/schedules',
  requirePermission(FLEET_MANAGE),
  body('vehicleId').isString().notEmpty().withMessage('vehicleId is required.'),
  body('name').isString().notEmpty().withMessage('name is required.'),
  body('intervalKm').optional().isFloat({ gt: 0 }),
  body('intervalDays').optional().isFloat({ gt: 0 }),
  validate, controller.createSchedule);

router.post('/schedules/:id/service-completed', requirePermission(FLEET_MANAGE), controller.recordServiceCompleted);

module.exports = router;
