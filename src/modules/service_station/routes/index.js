const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/vehicleController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('service_station'));

router.get('/vehicles', controller.listVehicles); // ?customerId=
router.post('/vehicles',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('registrationNumber').isString().trim().notEmpty().withMessage('registrationNumber is required.'),
  validate, controller.registerVehicle);
router.patch('/vehicles/:id/mileage', body('mileage').isFloat({ min: 0 }).withMessage('mileage must be a non-negative number.'), validate, controller.updateMileage);
router.get('/vehicles/:id/history', controller.serviceHistory);
router.post('/vehicles/:id/job-cards',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('itemDescription').isString().trim().notEmpty().withMessage('itemDescription is required.'),
  validate, controller.openJobCard);
router.post('/vehicles/:id/service-completed', controller.recordServiceCompleted); // { serviceOrderId?, mileageAtService?, serviceDate? }

router.get('/due', controller.listServiceDue);

module.exports = router;
