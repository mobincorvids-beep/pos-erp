const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { EXPENSE_SUBMIT, EXPENSE_APPROVE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/expenseController');

const createValidation = [
  body('categoryId').isString().notEmpty().withMessage('categoryId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
];

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', requirePermission(EXPENSE_SUBMIT), createValidation, validate, controller.create);
router.post('/:id/approve', requirePermission(EXPENSE_APPROVE), controller.approve); // posts the ledger voucher
router.post('/:id/reject', requirePermission(EXPENSE_APPROVE), controller.reject);

module.exports = router;
