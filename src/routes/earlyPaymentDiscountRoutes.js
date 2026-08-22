const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SUPPLIER_PAYMENT_RECORD } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/earlyPaymentDiscountController');

router.use(requireAuth, scopeToCompany);

router.post('/:id/terms',
  requirePermission(SUPPLIER_PAYMENT_RECORD),
  body('earlyPaymentDiscountPercent').isFloat({ min: 0, max: 100 }).withMessage('earlyPaymentDiscountPercent must be between 0 and 100.'),
  body('earlyPaymentDiscountDays').isInt({ min: 0 }).withMessage('earlyPaymentDiscountDays must be a non-negative integer.'),
  validate, controller.setDiscountTerms);
router.get('/:id/calculate', controller.calculateDiscount); // ?paymentDate=
router.post('/:id/pay', requirePermission(SUPPLIER_PAYMENT_RECORD),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  body('discountIncomeAccountId').isString().notEmpty().withMessage('discountIncomeAccountId is required.'),
  body('payableAccountId').isString().notEmpty().withMessage('payableAccountId is required.'),
  validate, controller.payWithEarlyDiscount);

module.exports = router;
