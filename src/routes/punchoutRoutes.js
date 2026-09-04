const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PURCHASE_CREATE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/punchoutController');

router.use(requireAuth, scopeToCompany, requirePermission(PURCHASE_CREATE));

// "Shop" every active supplier's catalog, or one supplier's — ?supplierId= &search=
router.get('/catalog', controller.browse);

// Checkout: cart -> a real PurchaseRequisition.
router.post('/checkout',
  body('branchId').notEmpty().withMessage('branchId is required.'),
  body('cart').isArray({ min: 1 }).withMessage('cart must be a non-empty array.'),
  validate, controller.checkout);

module.exports = router;
