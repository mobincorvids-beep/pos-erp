const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { TAX_PAYMENTS_VIEW, TAX_PAYMENTS_CREATE, TAX_PAYMENTS_PAY } = require('../constants/permissions');
const controller = require('../controllers/taxPaymentController');

const createValidation = [
  body('periodLabel').notEmpty().withMessage('periodLabel is required.'),
  body('amountDue').isFloat({ gt: 0 }).withMessage('amountDue must be greater than zero.'),
  body('taxAuthority').optional().isIn(['fbr', 'srb', 'pra', 'kpra', 'bra']).withMessage('taxAuthority must be a supported tax authority.'),
];

// PUBLIC — hit directly by JazzCash's own servers, no bearer token
// available to them. Signature verification inside taxPaymentService is
// the entire auth story for this route, same pattern as
// paymentGatewayRoutes' /callback/:provider. Mounted BEFORE requireAuth.
router.post('/jazzcash-callback', controller.jazzCashCallback);

router.use(requireAuth, scopeToCompany);
router.get('/', requirePermission(TAX_PAYMENTS_VIEW), controller.list);
router.get('/:id', requirePermission(TAX_PAYMENTS_VIEW), controller.getOne);
router.post('/', requirePermission(TAX_PAYMENTS_CREATE), createValidation, validate, controller.create);
router.post('/:id/pay', requirePermission(TAX_PAYMENTS_PAY), controller.pay);

module.exports = router;
