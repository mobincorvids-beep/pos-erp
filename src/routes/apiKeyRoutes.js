const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const controller = require('../controllers/apiKeyController');

// 'developer_platform.manage' is not yet registered in
// src/constants/permissions.js (that file is out of scope for this change
// — see the final report for the exact KEYS/CATALOG entry to add there).
// Passed as a plain string here; requirePermission() only ever compares
// strings, so this works today and just needs the constants file to catch
// up so it shows in the role-editor UI.
const DEVELOPER_PLATFORM_MANAGE = 'developer_platform.manage';

router.use(requireAuth, scopeToCompany, requirePermission(DEVELOPER_PLATFORM_MANAGE));

router.get('/', controller.list);
router.get('/scopes', controller.scopes); // available scopes for the create-key form
router.post('/', controller.create);
router.post('/:id/revoke', controller.revoke);

module.exports = router;
