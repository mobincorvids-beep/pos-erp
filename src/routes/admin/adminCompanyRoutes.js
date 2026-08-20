const router = require('express').Router();
const { requirePlatformAdmin, requireAdminRole } = require('../../middleware/platformAuth');
const controller = require('../../controllers/admin/adminCompanyController');

router.use(requirePlatformAdmin);

router.get('/catalog', controller.catalog); // industries + optional modules reference data
router.get('/', controller.list);            // ?isActive=true&industryType=...
router.get('/:id', controller.get);
router.post('/', requireAdminRole, controller.onboard);              // creates Company + branch/warehouse/accounts + first admin user
router.patch('/:id', requireAdminRole, controller.update);
router.post('/:id/active', requireAdminRole, controller.setActive);   // { isActive: true|false }
router.patch('/:id/modules', requireAdminRole, controller.setModules); // { activeModules: [...] }
router.get('/:id/sales-volume', controller.salesVolume);              // ?from=&to=

module.exports = router;
