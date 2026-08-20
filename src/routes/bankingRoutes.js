const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission, requireBranchAccess } = require('../middleware/auth');
const { BANKING_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/bankingController');

const transferValidation = [
  body('fromAccountId').isString().notEmpty().withMessage('fromAccountId is required.'),
  body('toAccountId').isString().notEmpty().withMessage('toAccountId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
];
const reconciliationValidation = [
  body('accountId').isString().notEmpty().withMessage('accountId is required.'),
  body('statementDate').isISO8601().withMessage('statementDate must be a valid date.'),
  body('statementBalance').isFloat().withMessage('statementBalance must be a number.'),
];

router.use(requireAuth, scopeToCompany, requirePermission(BANKING_MANAGE));

router.post('/transfers', requireBranchAccess(), transferValidation, validate, controller.transfer); // { fromAccountId, toAccountId, amount, note? }
router.post('/vouchers/:voucherId/reverse', controller.reverseVoucher);

router.post('/reconciliations', reconciliationValidation, validate, controller.startReconciliation);
router.get('/reconciliations/:id', controller.reconciliationDetail);
router.patch('/reconciliations/:id/clear', controller.markCleared); // { voucherIds: [...] }
router.post('/reconciliations/:id/complete', controller.completeReconciliation);

module.exports = router;
