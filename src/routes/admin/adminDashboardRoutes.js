const router = require('express').Router();
const { requirePlatformAdmin } = require('../../middleware/platformAuth');
const controller = require('../../controllers/admin/adminDashboardController');

router.use(requirePlatformAdmin);
router.get('/overview', controller.overview); // ?from=&to=

module.exports = router;
