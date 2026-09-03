const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { CHEQUES_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/chequeController');

const recordValidation = [
  body('direction').isIn(['receivable', 'payable']).withMessage("direction must be 'receivable' or 'payable'."),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('chequeNumber').isString().trim().notEmpty().withMessage('chequeNumber is required.'),
  body('bankName').isString().trim().notEmpty().withMessage('bankName is required.'),
  body('chequeDate').isISO8601().withMessage('chequeDate must be a valid date.'),
];

router.use(requireAuth, scopeToCompany);
router.get('/', requirePermission(CHEQUES_MANAGE), controller.list); // ?status=&direction=&from=&to=
router.get('/due-soon', requirePermission(CHEQUES_MANAGE), controller.dueSoon); // ?days=7
router.post('/', requirePermission(CHEQUES_MANAGE), recordValidation, validate, controller.record);
router.post('/:id/clear', requirePermission(CHEQUES_MANAGE), controller.markCleared);
router.post('/:id/bounce', requirePermission(CHEQUES_MANAGE), controller.markBounced); // { reason }

module.exports = router;
