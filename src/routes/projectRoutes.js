const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/projectController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list); // ?status=
router.post('/', controller.create);
router.patch('/:id/status', controller.updateStatus);
router.get('/:id/costs', controller.listCosts);
router.post('/:id/costs', controller.logManualCost); // manual entries only — most costs arrive automatically, see projectService
router.get('/:id/profitability', controller.profitability);

module.exports = router;
