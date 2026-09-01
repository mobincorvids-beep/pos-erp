const router = require('express').Router();
const { body, query } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/taskController');

router.use(requireAuth, scopeToCompany);

router.get('/', query('projectId').isString().notEmpty().withMessage('projectId is required.'), validate, controller.list); // ?projectId=
router.post('/',
  body('projectId').isString().notEmpty().withMessage('projectId is required.'),
  body('title').isString().notEmpty().withMessage('title is required.'),
  body('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Invalid priority.'),
  validate, controller.create);
router.patch('/:id/status',
  body('status').isIn(['todo', 'in_progress', 'done']).withMessage('Invalid status.'),
  validate, controller.updateStatus);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);

module.exports = router;
