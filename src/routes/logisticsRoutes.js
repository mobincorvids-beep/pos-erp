const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const controller = require('../controllers/logisticsController');

// New permission key, deliberately NOT added to src/constants/permissions.js
// by this module (that file is shared/concurrently edited) — called here
// by its literal string the same way a KEYS constant would resolve.
// Report requests permissions.js add:
//   KEYS.LOGISTICS_MANAGE = 'logistics.manage'
const LOGISTICS_MANAGE = 'logistics.manage';

router.use(requireAuth, scopeToCompany, requirePermission(LOGISTICS_MANAGE));

router.get('/', controller.list);
router.get('/track/:trackingNumber', controller.track);
router.get('/:id', controller.getOne);
router.get('/:id/timeline', controller.timeline);
router.post('/', controller.create);
router.post('/:id/status', controller.updateStatus);
router.post('/:id/assign', controller.assign);
router.post('/:id/deliver', controller.deliver);

module.exports = router;
