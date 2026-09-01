const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { CUSTOMER_PAYMENT_RECORD } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/customerController');

const paymentValidation = [
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
];
const createValidation = [
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('tags').optional().isArray({ max: 10 }).withMessage('tags must be an array of at most 10 items.'),
  body('tags.*').isString().trim().isLength({ min: 1, max: 30 }).withMessage('Each tag must be 1-30 characters.'),
];

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', createValidation, validate, controller.create);
router.put('/:id', createValidation, validate, controller.update);
router.get('/aging', controller.aging); // must be before /:id/ledger to avoid route collision
router.get('/:id/ledger', controller.getLedger);
router.post('/:id/payments', requirePermission(CUSTOMER_PAYMENT_RECORD), paymentValidation, validate, controller.recordPayment);

module.exports = router;
