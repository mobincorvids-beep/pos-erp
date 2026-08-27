const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const controller = require('../controllers/warehouseZoneController');

const PERMISSION = 'warehouse.manage';

router.use(requireAuth, scopeToCompany);

router.get('/zones', controller.listZones); // ?warehouseId=
router.post('/zones', requirePermission(PERMISSION), controller.createZone);

router.get('/bins', controller.listBins); // ?warehouseId= (required)
router.post('/bins', requirePermission(PERMISSION), controller.createBin);
router.put('/bins/:id', requirePermission(PERMISSION), controller.updateBin);

router.get('/bin-stock', controller.listBinStockRaw); // ?warehouseId=
router.get('/bin-stock/summary', controller.stockSummary); // ?warehouseId=
router.post('/bin-stock/assign', requirePermission(PERMISSION), controller.assignStock);
router.post('/bin-stock/move', requirePermission(PERMISSION), controller.moveStock);

module.exports = router;
