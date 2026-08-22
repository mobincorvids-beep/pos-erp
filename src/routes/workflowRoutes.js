const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ROLES_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/workflowController');

router.use(requireAuth, scopeToCompany);
router.post('/', requirePermission(ROLES_MANAGE),
  body('entityType').isString().trim().notEmpty().withMessage('entityType is required.'),
  body('steps').isArray({ min: 1 }).withMessage('At least one step is required.'),
  body('steps.*.order').isInt({ min: 1 }).withMessage('Each step needs a positive order.'),
  body('steps.*.roleId').isString().notEmpty().withMessage('Each step needs a roleId.'),
  validate, controller.defineWorkflow);
router.get('/:entityType', controller.getWorkflow);

module.exports = router;
