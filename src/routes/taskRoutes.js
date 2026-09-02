const router = require('express').Router();
const { body, query } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PROJECT_TASKS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/taskController');

router.use(requireAuth, scopeToCompany);

router.get('/', query('projectId').isString().notEmpty().withMessage('projectId is required.'), validate, controller.list); // ?projectId=
router.get('/:id/subtasks', controller.listSubtasks);
router.post('/',
  requirePermission(PROJECT_TASKS_MANAGE),
  body('projectId').isString().notEmpty().withMessage('projectId is required.'),
  body('title').isString().notEmpty().withMessage('title is required.'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority.'),
  body('parentTaskId').optional().isString(),
  body('customFields').optional().isArray().withMessage('customFields must be an array.'),
  body('blockedByTaskIds').optional().isArray().withMessage('blockedByTaskIds must be an array.'),
  validate, controller.create);
// Cheap PATCH used by the Kanban board's drag-and-drop — updates only status.
router.patch('/:id/status',
  requirePermission(PROJECT_TASKS_MANAGE),
  body('status').isIn(['todo', 'in_progress', 'review', 'done']).withMessage('Invalid status.'),
  validate, controller.updateStatus);
router.patch('/:id', requirePermission(PROJECT_TASKS_MANAGE), controller.update);
router.delete('/:id', requirePermission(PROJECT_TASKS_MANAGE), controller.remove);

module.exports = router;
