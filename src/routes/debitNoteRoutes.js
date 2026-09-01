const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { DEBIT_NOTES_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/debitNoteController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  requirePermission(DEBIT_NOTES_MANAGE),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('purchaseOrderId').optional().isString(),
  body('reason').optional().isString(),
  validate, controller.issueDebitNote);
router.get('/', controller.listDebitNotes); // ?supplierId=&status=&purchaseOrderId=
router.post('/:id/void',
  requirePermission(DEBIT_NOTES_MANAGE),
  controller.voidDebitNote);

module.exports = router;
