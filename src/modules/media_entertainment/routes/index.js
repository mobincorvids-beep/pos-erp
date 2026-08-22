const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/eventTicketingController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('media_entertainment'));

router.post('/shows',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('eventName').isString().trim().notEmpty().withMessage('eventName is required.'),
  body('showDateTime').isISO8601().withMessage('showDateTime must be a valid date.'),
  body('tiers').isArray({ min: 1 }).withMessage('At least one seating tier is required.'),
  body('tiers.*.name').isString().trim().notEmpty().withMessage('Each tier needs a name.'),
  body('tiers.*.capacity').isInt({ gt: 0 }).withMessage('Each tier needs a capacity greater than zero.'),
  body('tiers.*.price').isFloat({ gt: 0 }).withMessage('Each tier needs a price greater than zero.'),
  validate, controller.createShow);
router.get('/shows', controller.listShows); // ?status=
router.get('/shows/:showId/roster', controller.showRoster);
router.post('/shows/:showId/tiers/:tierId/book',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('ticketBillingProductId').isString().notEmpty().withMessage('ticketBillingProductId is required.'),
  body('ticketBillingVariantId').isString().notEmpty().withMessage('ticketBillingVariantId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.bookTicket);
router.post('/shows/:showId/tiers/:tierId/customers/:customerId/cancel', controller.cancelTicket);

module.exports = router;
