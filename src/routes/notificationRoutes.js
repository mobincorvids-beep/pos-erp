const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/notificationController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list); // ?unreadOnly=true
router.get('/unread-count', controller.unreadCount);
router.post('/:id/read', controller.markRead);
router.post('/mark-all-read', controller.markAllRead);

module.exports = router;
