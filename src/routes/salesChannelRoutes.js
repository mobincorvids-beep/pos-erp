const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ECOMMERCE_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/salesChannelController');

// Public webhook receiver FIRST and unguarded — same no-JWT pattern as
// ecommerceWebhookRoutes.js: the per-channel token in the URL is the whole
// auth story here, resolved inside salesChannelService.receiveOrder().
router.post('/webhook/:token', controller.webhook);

// Everything else is staff-authenticated tenant configuration, gated by the
// same ECOMMERCE_MANAGE permission the existing single-channel config uses.
router.use(requireAuth, scopeToCompany, requirePermission(ECOMMERCE_MANAGE));
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/analytics', controller.analytics);
router.post('/:id/toggle', controller.toggle);
router.post('/:id/regenerate-token', controller.regenerateToken);

module.exports = router;
