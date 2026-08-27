const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const controller = require('../controllers/webhookSubscriptionController');

// Same permission key as apiKeyRoutes.js — the Developer Platform (keys +
// webhooks) is one manageable unit. See that file's comment: this key is
// not yet registered in src/constants/permissions.js (out of scope here).
const DEVELOPER_PLATFORM_MANAGE = 'developer_platform.manage';

router.use(requireAuth, scopeToCompany, requirePermission(DEVELOPER_PLATFORM_MANAGE));

router.get('/', controller.list);
router.get('/events', controller.events); // available event types for the create-subscription form
router.post('/', controller.create);
router.delete('/:id', controller.remove);

module.exports = router;
