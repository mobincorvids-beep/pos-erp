const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/sportsController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('sports'));

router.post('/facilities',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('hourlyRate').isFloat({ gt: 0 }).withMessage('hourlyRate must be greater than zero.'),
  validate, controller.createFacility);
router.get('/facilities', controller.listFacilities); // ?branchId=
router.post('/facilities/:facilityId/book',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('startTime').isISO8601().withMessage('startTime must be a valid date/time.'),
  body('endTime').isISO8601().withMessage('endTime must be a valid date/time.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.bookSlot);
router.get('/bookings', controller.listBookings); // ?facilityId=&status=
router.post('/bookings/:id/cancel', controller.cancelSlot);

module.exports = router;
