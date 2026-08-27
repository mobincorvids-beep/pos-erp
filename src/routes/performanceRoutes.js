const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PERFORMANCE_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/performanceController');

router.use(requireAuth, scopeToCompany);

// --- Goals -------------------------------------------------------------------

router.get('/goals', controller.listGoals); // ?employeeId=&status=&category=
router.post('/goals', requirePermission(PERFORMANCE_MANAGE),
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('title').isString().trim().notEmpty().withMessage('Goal title is required.'),
  validate, controller.createGoal);
router.post('/goals/:id/progress', requirePermission(PERFORMANCE_MANAGE),
  body('currentValue').isNumeric().withMessage('currentValue must be a number.'),
  validate, controller.updateGoalProgress);
router.post('/goals/:id/status', requirePermission(PERFORMANCE_MANAGE),
  body('status').isIn(['not_started', 'in_progress', 'at_risk', 'completed', 'cancelled']).withMessage('Invalid status.'),
  validate, controller.updateGoalStatus);

// --- Reviews -----------------------------------------------------------------

router.get('/reviews', controller.listReviews); // ?employeeId=&status=&period=
router.post('/reviews', requirePermission(PERFORMANCE_MANAGE),
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('period').isString().trim().notEmpty().withMessage('period is required.'),
  validate, controller.createReview);
router.post('/reviews/:id/submit', requirePermission(PERFORMANCE_MANAGE), controller.submitReview);
// Employee-side confirmation — deliberately left open like leave-request
// submission in hrRoutes, not gated by PERFORMANCE_MANAGE, since the
// employee acknowledging their own review is not a manager action.
router.post('/reviews/:id/acknowledge', controller.acknowledgeReview);

// --- Scorecard -----------------------------------------------------------------

router.get('/scorecard/:employeeId', controller.employeeScorecard);

module.exports = router;
