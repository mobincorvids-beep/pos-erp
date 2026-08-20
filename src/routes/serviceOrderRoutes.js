const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SERVICE_ORDER_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/serviceOrderController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);              // ?status=...&assignedTechnicianId=...
router.post('/', requirePermission(SERVICE_ORDER_MANAGE), controller.create);
router.patch('/:id/status', controller.updateStatus); // routine technician update — left open, same as appointment status
router.post('/:id/parts', requirePermission(SERVICE_ORDER_MANAGE), controller.addPart);           // deducts inventory
router.patch('/:id/labor-charge', requirePermission(SERVICE_ORDER_MANAGE), controller.setLaborCharge); // { laborCharge }
router.post('/:id/bill', requirePermission(SERVICE_ORDER_MANAGE), controller.bill);                // moves money/stock

module.exports = router;
