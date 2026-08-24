const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/bookingController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('banquet'));

router.get('/venues', controller.listVenues); // ?branchId=
router.post('/venues',
  body('name').isString().notEmpty().withMessage('name is required.'),
  body('capacity').isFloat({ gt: 0 }).withMessage('capacity must be greater than zero.'),
  body('rentalBillingProductId').isString().notEmpty().withMessage('rentalBillingProductId is required — must be a Product with trackingMode "service".'),
  body('rentalBillingVariantId').isString().notEmpty().withMessage('rentalBillingVariantId is required.'),
  validate, controller.createVenue);
router.get('/venues/:venueId/availability', controller.checkAvailability); // ?eventDate=
router.put('/venues/:venueId', controller.updateVenue);
router.delete('/venues/:venueId', controller.deactivateVenue);

router.get('/packages', controller.listPackages);
router.post('/packages',
  body('name').isString().notEmpty().withMessage('name is required.'),
  body('pricePerPerson').isFloat({ gt: 0 }).withMessage('pricePerPerson must be greater than zero.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.createPackage);
router.put('/packages/:packageId', controller.updatePackage);
router.delete('/packages/:packageId', controller.deactivatePackage);

router.post('/bookings',
  body('venueId').isString().notEmpty().withMessage('venueId is required.'),
  body('packageId').isString().notEmpty().withMessage('packageId is required.'),
  body('eventDate').isISO8601().withMessage('eventDate must be a valid date.'),
  body('guestCount').isFloat({ gt: 0 }).withMessage('guestCount must be greater than zero.'),
  validate, controller.bookEvent);
router.get('/bookings', controller.listBookings); // ?status=&venueId=
router.post('/bookings/:id/complete',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.completeEvent);
router.post('/bookings/:id/cancel',
  body('forfeitPercent').optional().isFloat({ min: 0, max: 100 }).withMessage('forfeitPercent must be between 0 and 100.'),
  validate, controller.cancelBooking);

module.exports = router;
