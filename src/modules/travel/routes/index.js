const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/travelController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('travel'));

router.post('/bookings',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('packageName').isString().trim().notEmpty().withMessage('packageName is required.'),
  body('travelDate').isISO8601().withMessage('travelDate must be a valid date.'),
  body('price').isFloat({ gt: 0 }).withMessage('price must be greater than zero.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.bookPackage);
router.get('/bookings', controller.listBookings); // ?status=
router.post('/bookings/:id/finalize', body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'), validate, controller.finalizeBooking);
router.post('/bookings/:id/cancel', controller.cancelBooking);

module.exports = router;
