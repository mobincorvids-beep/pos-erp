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
const parseStatementValidation = [
  body('csv').isString().notEmpty().withMessage('csv text is required.'),
];
const importStatementValidation = [
  body('lines').isArray({ min: 1 }).withMessage('lines must be a non-empty array.'),
  body('lines.*.date').isISO8601().withMessage('each line needs a valid date.'),
  body('lines.*.description').optional({ nullable: true }).isString(),
  body('lines.*.amount').isFloat().withMessage('each line needs a numeric amount.'),
];
const matchLineValidation = [
  body('voucherId').isString().notEmpty().withMessage('voucherId is required.'),
];

router.use(requireAuth, scopeToCompany, requirePermission(BANKING_MANAGE));

router.post('/transfers', requireBranchAccess(), transferValidation, validate, controller.transfer); // { fromAccountId, toAccountId, amount, note? }
router.post('/vouchers/:voucherId/reverse', controller.reverseVoucher);

router.post('/reconciliations', reconciliationValidation, validate, controller.startReconciliation);
router.get('/reconciliations/:id', controller.reconciliationDetail);
router.patch('/reconciliations/:id/clear', controller.markCleared); // { voucherIds: [...] }
router.post('/reconciliations/:id/complete', controller.completeReconciliation);

// Statement import & auto-matching
router.post('/statement/parse', parseStatementValidation, validate, controller.parseStatement); // { csv } -> preview, no persistence
router.post('/reconciliations/:id/import-statement', importStatementValidation, validate, controller.importStatement); // { lines: [{date, description, amount}] }
router.get('/reconciliations/:id/summary', controller.reconciliationSummary);
router.patch('/reconciliations/:id/lines/:lineId/match', matchLineValidation, validate, controller.matchLine); // { voucherId }
router.patch('/reconciliations/:id/lines/:lineId/no-match', controller.noMatchLine);
router.patch('/reconciliations/:id/lines/:lineId/reset', controller.resetLine);

module.exports = router;
