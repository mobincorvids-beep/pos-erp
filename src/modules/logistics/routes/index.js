const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/logisticsController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('logistics'));

router.post('/vehicles', body('branchId').isString().notEmpty().withMessage('branchId is required.'), body('registrationNumber').isString().trim().notEmpty().withMessage('registrationNumber is required.'), validate, controller.createVehicle);
router.get('/vehicles', controller.listVehicles);
router.post('/drivers', body('name').isString().trim().notEmpty().withMessage('name is required.'), validate, controller.createDriver);
router.get('/drivers', controller.listDrivers);
router.post('/trips',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('vehicleId').isString().notEmpty().withMessage('vehicleId is required.'),
  body('driverId').isString().notEmpty().withMessage('driverId is required.'),
  body('startOdometer').isFloat({ min: 0 }).withMessage('startOdometer is required.'),
  validate, controller.startTrip);
router.post('/trips/:id/deliveries', body('revenue').isFloat({ gt: 0 }).withMessage('revenue must be greater than zero.'), validate, controller.addDeliveryToTrip);
router.get('/trips', controller.listTrips); // ?vehicleId=&status=
router.post('/trips/:id/complete', body('endOdometer').isFloat({ min: 0 }).withMessage('endOdometer is required.'), validate, controller.completeTrip);

module.exports = router;
