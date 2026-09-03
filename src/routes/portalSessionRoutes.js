const router = require('express').Router();
const { body } = require('express-validator');
const { requirePortalAuth } = require('../middleware/portalAuth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/portalController');

// Unauthenticated — activating an invite and logging in are how a portal
// session BEGINS, so neither can require one first.
router.post('/activate',
  body('inviteToken').isString().notEmpty().withMessage('inviteToken is required.'),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  validate, controller.activateInvite);
router.post('/login',
  body('email').isEmail().withMessage('A valid email is required.'),
  body('password').isString().notEmpty().withMessage('password is required.'),
  validate, controller.login);
router.post('/refresh', body('refreshToken').isString().notEmpty().withMessage('refreshToken is required.'), validate, controller.refresh);

// Everything below requires a real portal session.
router.use(requirePortalAuth);
router.get('/dashboard', controller.dashboard);
router.get('/invoices', controller.listInvoices); // ?status=due
router.get('/invoices/:saleId', controller.getInvoice);
router.post('/tickets',
  body('category').isString().trim().notEmpty().withMessage('category is required.'),
  body('subject').isString().trim().notEmpty().withMessage('subject is required.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  validate, controller.submitTicket);

// Ecommerce order tracking — the customer's own online-store orders only
// (see portalService.listEcommerceOrders/getEcommerceOrder), separate from
// the general invoices/:saleId above since not every invoice came through
// the ecommerce channel and this shape carries a derived trackingStatus.
router.get('/orders', controller.listEcommerceOrders);
router.get('/orders/:saleId', controller.getEcommerceOrder);

// Wishlist — scoped to the logged-in customer via req.portalAuth, never a
// customerId taken from the request.
router.get('/wishlist', controller.listWishlist);
router.post('/wishlist',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  validate, controller.addToWishlist);
router.delete('/wishlist/:itemId', controller.removeFromWishlist);

module.exports = router;
