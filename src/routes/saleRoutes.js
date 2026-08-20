const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission, requireBranchAccess } = require('../middleware/auth');
const { POS_SELL, SALES_VIEW } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/saleController');

// Shape-level checks only — business rules (stock availability, account
// existence, whether a discount is legitimate) stay in posSaleService,
// which already validates and computes totals server-side rather than
// trusting the client's numbers. This layer exists to reject an obviously
// malformed request (negative quantity, missing warehouse) before it ever
// reaches that logic, with a clear field-level message instead of a
// confusing downstream error.
const checkoutValidation = [
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required.'),
  body('items.*.productId').isString().notEmpty().withMessage('Each item needs a productId.'),
  body('items.*.variantId').isString().notEmpty().withMessage('Each item needs a variantId.'),
  body('items.*.quantity').isFloat({ gt: 0 }).withMessage('Item quantity must be greater than zero.'),
  body('items.*.unitPrice').isFloat({ min: 0 }).withMessage('Item unitPrice cannot be negative.'),
  body('payments').optional().isArray(),
  body('payments.*.amount').optional().isFloat({ min: 0 }).withMessage('Payment amount cannot be negative.'),
];

router.use(requireAuth, scopeToCompany);
router.get('/', requirePermission(SALES_VIEW), controller.list); // ?status=...&from=...&to=...&limit=...
router.get('/:id', requirePermission(SALES_VIEW), controller.get);
router.post('/checkout', requirePermission(POS_SELL), requireBranchAccess(), checkoutValidation, validate, controller.checkout);
router.post('/:id/fbr-submit', controller.submitFbr); // manual retry for FBR digital invoicing specifically
router.post('/:id/tax-compliance-submit', controller.submitTaxCompliance); // manual retry across every registered authority
router.post('/tax-compliance/retry-pending', requirePermission(SALES_VIEW), controller.retryTaxCompliance); // bulk reconciliation: retry every sale still missing a submission, ?limit=
router.post('/:id/return', controller.processReturn); // { items: [...], refundAccountId, reason }
router.post('/:id/void', controller.voidSale);          // { reason }

module.exports = router;
