const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_FINANCIAL } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/costCenterController');

router.use(requireAuth, scopeToCompany);

router.post('/', body('name').isString().trim().notEmpty().withMessage('name is required.'), validate, controller.createCostCenter);
router.get('/', controller.listCostCenters);
router.get('/:id/profit-and-loss', requirePermission(REPORTS_FINANCIAL), controller.profitAndLoss); // ?from=&to=

module.exports = router;
