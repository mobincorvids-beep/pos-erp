const router = require('express').Router();

router.use('/auth', require('./adminAuthRoutes'));
router.use('/companies', require('./adminCompanyRoutes'));
router.use('/users', require('./adminUserRoutes'));
router.use('/audit-logs', require('./adminAuditRoutes'));
router.use('/dashboard', require('./adminDashboardRoutes'));

module.exports = router;
