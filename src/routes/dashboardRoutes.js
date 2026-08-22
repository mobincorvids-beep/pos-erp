const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/dashboardController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.getDashboard);
router.get('/home', controller.getHomeDashboard);

module.exports = router;
