const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { CHANGE_ORDERS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/changeOrderController');

// Change order tracking for a project's scope/budget changes. Mount this
// router at '/change-orders' in src/routes/index.js:
//   router.use('/change-orders', require('./changeOrderRoutes'));
router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?projectId=&status=
router.post('/',
  body('projectId').isString().notEmpty().withMessage('projectId is required.'),
  body('description').isString().notEmpty().withMessage('description is required.'),
  body('budgetImpact').isNumeric().withMessage('budgetImpact must be a number.'),
  validate, controller.create);
router.get('/:id', controller.get);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

// Approve/reject adjust the project's budget total (see changeOrderService.approveChangeOrder).
router.post('/:id/approve', requirePermission(CHANGE_ORDERS_MANAGE), controller.approve);
router.post('/:id/reject', requirePermission(CHANGE_ORDERS_MANAGE), controller.reject);

module.exports = router;
