// NOT wired into src/routes/index.js yet — mount with:
//   router.use('/fleet/incidents', require('./vehicleIncidentRoutes'));
const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/vehicleIncidentController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.listIncidents); // ?vehicleId=&type=&claimStatus=
router.get('/:id', controller.getIncident);
router.post('/',
  body('vehicleId').isString().notEmpty().withMessage('vehicleId is required.'),
  body('type').isIn(['accident', 'damage', 'theft', 'other']).withMessage('Invalid type.'),
  validate, requirePermission('fleet.incidents.manage'), controller.createIncident);
router.put('/:id', requirePermission('fleet.incidents.manage'), controller.updateIncident);

module.exports = router;
