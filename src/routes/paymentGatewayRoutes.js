const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { POS_SELL } = require('../constants/permissions');
const controller = require('../controllers/paymentGatewayController');

const initiateValidation = [
  body('provider').isIn(['jazzcash', 'easypaisa']).withMessage('provider must be jazzcash or easypaisa.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('phone').matches(/^03\d{9}$/).withMessage('phone must be a valid Pakistani mobile number (03XXXXXXXXX).'),
];

// PUBLIC — hit directly by JazzCash's/Easypaisa's own servers, no bearer
// token available to them. Signature verification inside the controller
// is the entire auth story for this one route, same pattern as
// ecommerceWebhookRoutes. Mounted BEFORE the requireAuth block below.
router.post('/callback/:provider', controller.callback);

router.use(requireAuth, scopeToCompany);
router.post('/initiate', requirePermission(POS_SELL), initiateValidation, validate, controller.initiate);
router.get('/transactions/:id', controller.getStatus);

// Ecommerce/storefront checkout-intent — { orderId, amount, provider?, phone? }
router.post('/checkout-intent',
  body('orderId').isString().notEmpty().withMessage('orderId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  validate, controller.createCheckoutIntent);

module.exports = router;
