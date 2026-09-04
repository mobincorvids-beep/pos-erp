const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PURCHASE_RECEIVE, SUPPLIER_PAYMENT_RECORD } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/consignmentController');

router.use(requireAuth, scopeToCompany);

// Consignment batches on hand — supplier-owned stock physically in our
// warehouse, not yet paid for. ?supplierId / ?warehouseId / ?productId to filter.
router.get('/', requirePermission(PURCHASE_RECEIVE), controller.list);

// Consumed-but-unsettled liability, per supplier (or all suppliers if
// ?supplierId is omitted) — what's actually owed right now.
router.get('/outstanding', requirePermission(PURCHASE_RECEIVE), controller.outstanding);

// Pay down consumed consignment liability for a supplier.
router.post('/settle',
  requirePermission(SUPPLIER_PAYMENT_RECORD),
  body('supplierId').notEmpty().withMessage('supplierId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('paymentAccountId').notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.settle);

module.exports = router;
