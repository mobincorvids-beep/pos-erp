const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/dashboardLayoutController');

// User-configurable dashboard widgets — persistence only, no permission
// gate beyond being an authenticated user of the company (every user
// manages their own layout). Mount at '/dashboard-layout' in
// src/routes/index.js:
//   router.use('/dashboard-layout', require('./dashboardLayoutRoutes'));
router.use(requireAuth, scopeToCompany);

router.get('/', controller.get);   // the current user's own layout (empty widgets[] if never saved)
router.put('/', controller.save);  // body: { widgets: [{ widgetType, position, config }] }

module.exports = router;
