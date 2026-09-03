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
router.get('/:id/profitability-by-category', controller.profitabilityByCategory); // Budget granularity by category — actual vs Project.budgetByCategory, bucketed by ProjectCost.type

// Multi-project resource/capacity view — per-employee allocated hours across
// all active projects in a date range, flagging over-100% allocation.
// Not project-scoped (no :id) — mounted at the router root, e.g.
// GET /projects/resource-capacity?from=&to=
router.get('/resource-capacity', controller.resourceCapacity); // ?from=&to=&standardHoursPerDay=

// Subcontractor cost tracking — sums subcontractor-tagged Expense/PO costs
// for this project separately from labor/material, and tracks retention
// (holdback) held vs released. See projectService.getProjectSubcontractorCosts.
router.get('/:id/subcontractor-costs', controller.subcontractorCosts);
router.post('/costs/:costId/release-retention', requirePermission(PROJECT_TASKS_MANAGE), controller.releaseRetention);

// Project docs/wiki — simple free-text/markdown notes pages, multiple per project.
router.get('/:id/docs', controller.listDocs);
router.post('/:id/docs',
  requirePermission(PROJECT_TASKS_MANAGE),
  body('title').isString().notEmpty().withMessage('title is required.'),
  validate, controller.createDoc);
router.patch('/:id/docs/:docId', requirePermission(PROJECT_TASKS_MANAGE), controller.updateDoc);
router.delete('/:id/docs/:docId', requirePermission(PROJECT_TASKS_MANAGE), controller.deleteDoc);

module.exports = router;
