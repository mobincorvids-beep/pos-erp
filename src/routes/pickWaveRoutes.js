const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const controller = require('../controllers/pickWaveController');

const PERMISSION = 'warehouse.manage';

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?warehouseId=
router.post('/', requirePermission(PERMISSION), controller.create); // { warehouseId, saleIds: [], assignedUserId? }
router.get('/:id/lines', controller.lines);
router.post('/:id/lines/:lineId/pick', requirePermission(PERMISSION), controller.pick); // { quantityPicked }
router.post('/:id/complete', requirePermission(PERMISSION), controller.complete);

module.exports = router;
