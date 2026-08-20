const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/hotelController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('hotel'));

router.get('/rooms', controller.listRooms); // ?branchId=
router.post('/rooms',
  body('roomNumber').isString().notEmpty().withMessage('roomNumber is required.'),
  body('ratePerNight').isFloat({ gt: 0 }).withMessage('ratePerNight must be greater than zero.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required — must be a Product with trackingMode "service".'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.createRoom);
router.get('/rooms/:roomId/availability', controller.checkAvailability); // ?checkInDate=&checkOutDate=
router.post('/rooms/:roomId/mark-clean', controller.markRoomClean);

router.post('/reservations',
  body('roomId').isString().notEmpty().withMessage('roomId is required.'),
  body('checkInDate').isISO8601().withMessage('checkInDate must be a valid date.'),
  body('checkOutDate').isISO8601().withMessage('checkOutDate must be a valid date.'),
  validate, controller.bookReservation);
router.get('/reservations', controller.listReservations); // ?status=&roomId=
router.post('/reservations/:id/check-in', controller.checkIn);
router.post('/reservations/:id/extras',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  body('unitPrice').isFloat({ min: 0 }).withMessage('unitPrice cannot be negative.'),
  validate, controller.addExtraCharge);
router.post('/reservations/:id/check-out',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.checkOut);
router.post('/reservations/:id/cancel', controller.cancelReservation);

module.exports = router;
