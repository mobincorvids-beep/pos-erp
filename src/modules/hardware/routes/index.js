const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/toolRentalController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('hardware'));

router.post('/rentals',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('dailyRate').isFloat({ gt: 0 }).withMessage('dailyRate must be greater than zero.'),
  body('depositAmount').isFloat({ gt: 0 }).withMessage('depositAmount must be greater than zero.'),
  body('expectedReturnDate').isISO8601().withMessage('expectedReturnDate must be a valid date.'),
  body('rentalBillingProductId').isString().notEmpty().withMessage('rentalBillingProductId is required.'),
  body('rentalBillingVariantId').isString().notEmpty().withMessage('rentalBillingVariantId is required.'),
  validate, controller.checkOutRental);
router.get('/rentals', controller.listRentals); // ?status=
router.post('/rentals/:id/return',
  body('condition').isIn(['good', 'minor_damage', 'lost_or_major_damage']).withMessage('condition must be "good", "minor_damage", or "lost_or_major_damage".'),
  body('finalPaymentAccountId').isString().notEmpty().withMessage('finalPaymentAccountId is required.'),
  validate, controller.returnRental);

module.exports = router;
