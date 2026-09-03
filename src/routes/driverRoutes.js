// NOT wired into src/routes/index.js yet — mount with:
//   router.use('/fleet/drivers', require('./driverRoutes'));
const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/driverController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.listDrivers); // ?status=&branchId=
router.get('/expiring-documents', controller.expiringDocuments); // ?withinDays= (default 30) — also fires the notification sweep
router.get('/:id', controller.getDriver);
router.post('/',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  validate, requirePermission('fleet.manage'), controller.createDriver);
router.put('/:id', requirePermission('fleet.manage'), controller.updateDriver);
router.post('/:id/documents',
  body('label').isString().trim().notEmpty().withMessage('label is required.'),
  validate, requirePermission('fleet.manage'), controller.addDriverDocument);

module.exports = router;
