/**
 * Route/van-sales — self-service ("my route") for a field rep resolved
 * from the logged-in user (same pattern as attendanceRoutes.js), plus a
 * gated manager view of every rep's assignments/visit history.
 */
const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ROUTE_SALES_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/routeSalesController');

router.use(requireAuth, scopeToCompany);

router.get('/me', controller.myRoute);
router.post('/visits',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('outcome').optional().isIn(['order_placed', 'no_order', 'closed', 'other']),
  validate, controller.logVisit);

router.get('/assignments', requirePermission(ROUTE_SALES_MANAGE), controller.assignments);
router.get('/visits', requirePermission(ROUTE_SALES_MANAGE), controller.visits);

module.exports = router;
