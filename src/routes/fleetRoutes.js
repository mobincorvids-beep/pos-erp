const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/fleetController');

router.use(requireAuth, scopeToCompany);

router.get('/vehicles', controller.listVehicles); // ?status=&type=
router.post('/vehicles',
  body('registrationNumber').isString().trim().notEmpty().withMessage('registrationNumber is required.'),
  validate, requirePermission('fleet.manage'), controller.registerVehicle);
router.get('/vehicles/:id', controller.getVehicle);
router.put('/vehicles/:id', requirePermission('fleet.manage'), controller.updateVehicle);
router.post('/vehicles/:id/status',
  body('status').isIn(['active', 'maintenance', 'retired']).withMessage('Invalid status.'),
  validate, requirePermission('fleet.manage'), controller.updateVehicleStatus);
router.post('/vehicles/:id/retire', requirePermission('fleet.manage'), controller.retireVehicle);
router.get('/vehicles/:id/history', controller.vehicleHistory);

router.get('/fuel-logs', controller.listFuelLogs); // ?vehicleId=
router.post('/fuel-logs',
  body('vehicleId').isString().notEmpty().withMessage('vehicleId is required.'),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  body('cost').isFloat({ gt: 0 }).withMessage('cost must be greater than zero.'),
  body('expenseAccountId').isString().notEmpty().withMessage('expenseAccountId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, requirePermission('fleet.manage'), controller.logFuel);

router.get('/trips', controller.listTrips); // ?vehicleId=&status=
router.post('/trips',
  body('vehicleId').isString().notEmpty().withMessage('vehicleId is required.'),
  validate, requirePermission('fleet.manage'), controller.startTrip);
router.post('/trips/:id/complete',
  body('endOdometer').isFloat().withMessage('endOdometer is required.'),
  validate, requirePermission('fleet.manage'), controller.completeTrip);
router.post('/trips/:id/cancel', requirePermission('fleet.manage'), controller.cancelTrip);

module.exports = router;
