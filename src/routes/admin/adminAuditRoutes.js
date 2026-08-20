const router = require('express').Router();
const { requirePlatformAdmin } = require('../../middleware/platformAuth');
const controller = require('../../controllers/admin/adminAuditController');

router.use(requirePlatformAdmin);
router.get('/', controller.list); // ?companyId=&entityType=&action=&limit=

module.exports = router;
