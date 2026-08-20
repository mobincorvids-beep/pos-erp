const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/auditLogController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list); // ?entityType=...&entityId=...&userId=...&limit=...

module.exports = router;
