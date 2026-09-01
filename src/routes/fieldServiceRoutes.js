const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { FIELD_SERVICE_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/fieldServiceController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);                                                        // ?status=...&assignedTechnicianId=...&from=...&to=...
router.get('/technicians/:technicianId/schedule', controller.schedule);                  // dispatch board — ?from=...&to=...
router.get('/:id', controller.get);
router.post('/', requirePermission(FIELD_SERVICE_MANAGE), controller.create);
router.patch('/:id/status', controller.updateStatus);                                    // routine technician update — left open, same as service order
router.patch('/:id/checklist', controller.updateChecklist);
router.post('/:id/parts', requirePermission(FIELD_SERVICE_MANAGE), controller.addPart);           // deducts inventory
router.patch('/:id/labor-charge', requirePermission(FIELD_SERVICE_MANAGE), controller.setLaborCharge); // { laborCharge }
router.post('/:id/bill', requirePermission(FIELD_SERVICE_MANAGE), controller.bill);               // moves money/stock

module.exports = router;
