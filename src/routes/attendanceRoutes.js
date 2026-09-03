/**
 * Self-service clock-in/out — new route file, separate from hrRoutes.js
 * (off-limits for concurrent-work reasons), mounted at /attendance from
 * routes/index.js. No requirePermission gate: any authenticated user with
 * a linked Employee record can clock themselves in/out — the controller
 * resolves "which employee" from the logged-in user, never from the body.
 */
const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/attendanceController');

router.use(requireAuth, scopeToCompany);
router.post('/clock-in', controller.clockIn);
router.post('/clock-out', controller.clockOut);
router.get('/me', controller.myStatus);

module.exports = router;
