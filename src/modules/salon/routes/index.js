const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/salonController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('salon'));

router.get('/services', controller.listServices);
router.post('/services', controller.createService);
router.put('/services/:id', controller.updateService);
router.delete('/services/:id', controller.deactivateService);
router.post('/services/bill',
  body('salonServiceId').isString().notEmpty().withMessage('salonServiceId is required.'),
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.billService);

router.get('/packages', controller.listPackages);
router.post('/packages', controller.createPackage);
router.put('/packages/:id', controller.updatePackage);
router.delete('/packages/:id', controller.deactivatePackage);
router.post('/packages/sell',
  body('membershipPackageId').isString().notEmpty().withMessage('membershipPackageId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.sellMembership);
router.get('/customers/:customerId/memberships', controller.customerMemberships);

router.get('/commissions', controller.listCommissions); // ?employeeId=
router.post('/payroll-runs/:payrollRunId/apply-commissions',
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be 1-12.'),
  body('year').isInt({ min: 2000 }).withMessage('year must be a valid year.'),
  validate, controller.applyCommissionsToPayroll);

module.exports = router;
