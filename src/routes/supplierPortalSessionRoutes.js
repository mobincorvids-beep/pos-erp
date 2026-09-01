const router = require('express').Router();
const { body } = require('express-validator');
const { requireSupplierPortalAuth } = require('../middleware/supplierPortalAuth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/supplierPortalController');

// Unauthenticated — activating an invite and logging in are how a supplier
// portal session BEGINS, so neither can require one first.
router.post('/activate',
  body('inviteToken').isString().notEmpty().withMessage('inviteToken is required.'),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  validate, controller.activateInvite);
router.post('/login',
  body('email').isEmail().withMessage('A valid email is required.'),
  body('password').isString().notEmpty().withMessage('password is required.'),
  validate, controller.login);
router.post('/refresh', body('refreshToken').isString().notEmpty().withMessage('refreshToken is required.'), validate, controller.refresh);

// Everything below requires a real supplier portal session.
router.use(requireSupplierPortalAuth);
router.get('/dashboard', controller.dashboard);
router.get('/purchase-orders', controller.myPurchaseOrders); // ?status=ordered etc
router.get('/purchase-orders/:poId', controller.getPurchaseOrder);
router.get('/payments', controller.myPayments);

module.exports = router;
