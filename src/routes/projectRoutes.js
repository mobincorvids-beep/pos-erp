const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PROJECT_TASKS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/projectController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list); // ?status=
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);
router.get('/:id/costs', controller.listCosts);
router.post('/:id/costs', controller.logManualCost); // manual entries only — most costs arrive automatically, see projectService
router.get('/:id/profitability', controller.profitability);

// Project docs/wiki — simple free-text/markdown notes pages, multiple per project.
router.get('/:id/docs', controller.listDocs);
router.post('/:id/docs',
  requirePermission(PROJECT_TASKS_MANAGE),
  body('title').isString().notEmpty().withMessage('title is required.'),
  validate, controller.createDoc);
router.patch('/:id/docs/:docId', requirePermission(PROJECT_TASKS_MANAGE), controller.updateDoc);
router.delete('/:id/docs/:docId', requirePermission(PROJECT_TASKS_MANAGE), controller.deleteDoc);

module.exports = router;
