const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/carRentalController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('car_rental'));

router.post('/fleet',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('vehicleClass').isString().trim().notEmpty().withMessage('vehicleClass is required.'),
  body('registrationNumber').isString().trim().notEmpty().withMessage('registrationNumber is required.'),
  body('dailyRate').isFloat({ gt: 0 }).withMessage('dailyRate must be greater than zero.'),
  validate, controller.addVehicle);
router.get('/fleet', controller.listFleet);
router.put('/fleet/:id',
  body('dailyRate').optional().isFloat({ gt: 0 }).withMessage('dailyRate must be greater than zero.'),
  body('status').optional().isIn(['available', 'rented', 'maintenance']).withMessage('Invalid status.'),
  validate, controller.updateVehicle);
router.delete('/fleet/:id', controller.deleteVehicle);
router.post('/bookings',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('vehicleClass').isString().notEmpty().withMessage('vehicleClass is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date.'),
  body('rentalBillingProductId').isString().notEmpty().withMessage('rentalBillingProductId is required.'),
  body('rentalBillingVariantId').isString().notEmpty().withMessage('rentalBillingVariantId is required.'),
  validate, controller.bookRental);
router.get('/bookings', controller.listBookings);
router.post('/bookings/:id/return', body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'), validate, controller.returnVehicle);
router.post('/bookings/:id/cancel', controller.cancelBooking);

module.exports = router;
