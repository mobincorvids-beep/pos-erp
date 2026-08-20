const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ROLES_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/roleController');

router.use(requireAuth, scopeToCompany);
router.get('/permissions-catalog', controller.permissionsCatalog); // must be before /:id to avoid route collision
router.get('/', controller.list);
router.post('/', requirePermission(ROLES_MANAGE), controller.create);
router.patch('/:id', requirePermission(ROLES_MANAGE), controller.update);

module.exports = router;
