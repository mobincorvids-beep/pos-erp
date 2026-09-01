const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { COUPON_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/couponController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  requirePermission(COUPON_MANAGE),
  body('code').isString().notEmpty().withMessage('code is required.'),
  body('discountType').isIn(['percent', 'fixed']).withMessage("discountType must be 'percent' or 'fixed'."),
  body('discountValue').isFloat({ gt: 0 }).withMessage('discountValue must be greater than zero.'),
  body('minPurchaseAmount').optional().isFloat({ min: 0 }).withMessage('minPurchaseAmount must be non-negative.'),
  body('maxUsageCount').optional({ nullable: true }).isInt({ min: 1 }).withMessage('maxUsageCount must be a positive integer, or omitted for unlimited.'),
  body('maxUsagePerCustomer').optional().isInt({ min: 1 }).withMessage('maxUsagePerCustomer must be a positive integer.'),
  validate, controller.createCoupon);

router.get('/', controller.listCoupons); // ?active=true|false

router.patch('/:id/active',
  requirePermission(COUPON_MANAGE),
  body('active').isBoolean().withMessage('active must be true or false.'),
  validate, controller.setActive);

// Left open to any authenticated staff member, same as pos.sell isn't
// required for loyalty redemption either — a cashier applying a coupon
// code at checkout is part of the normal sale, not a management action.
router.post('/validate',
  body('code').isString().notEmpty().withMessage('code is required.'),
  body('purchaseAmount').isFloat({ gt: 0 }).withMessage('purchaseAmount must be greater than zero.'),
  validate, controller.validate);

module.exports = router;
