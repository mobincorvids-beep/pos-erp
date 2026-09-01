const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CREDIT_NOTES_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/creditNoteController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  requirePermission(CREDIT_NOTES_MANAGE),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('saleId').optional().isString(),
  body('reason').optional().isString(),
  validate, controller.issueCreditNote);
router.get('/', controller.listCreditNotes); // ?customerId=&status=&saleId=
router.post('/:id/apply',
  requirePermission(CREDIT_NOTES_MANAGE),
  body('saleId').isString().notEmpty().withMessage('saleId is required.'),
  validate, controller.applyCreditNote);
router.post('/:id/void',
  requirePermission(CREDIT_NOTES_MANAGE),
  controller.voidCreditNote);

module.exports = router;
