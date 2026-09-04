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

// Vendor-Managed Inventory — this supplier's covered products with live
// on-hand, and proposing/tracking their own replenishment suggestions.
router.get('/vmi/visibility', controller.vmiVisibility);
router.post('/vmi/agreements/:agreementId/propose', controller.vmiPropose);
router.get('/vmi/proposals', controller.vmiMyProposals);

// Punchout-style catalog — the supplier maintains their own price/SKU
// catalog here; staff "shop" it inside the app (see punchoutRoutes.js)
// instead of a live redirect to a real punchout endpoint. See
// punchoutService's header comment for why this differs from true
// cXML/OCI punchout.
router.put('/catalog/items', controller.catalogUpsert);
router.get('/catalog/items', controller.catalogList);
router.delete('/catalog/items/:itemId', controller.catalogRemove);

module.exports = router;
