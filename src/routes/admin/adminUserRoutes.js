const router = require('express').Router();
const { requirePlatformAdmin, requireAdminRole } = require('../../middleware/platformAuth');
const controller = require('../../controllers/admin/adminUserController');

router.use(requirePlatformAdmin);
router.get('/', controller.list); // ?companyId=&isActive=
router.post('/:id/active', requireAdminRole, controller.setActive); // { isActive: true|false }

module.exports = router;
