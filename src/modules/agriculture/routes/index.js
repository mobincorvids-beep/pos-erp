const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/agricultureController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('agriculture'));

router.post('/fields',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('areaAcres').isFloat({ gt: 0 }).withMessage('areaAcres must be greater than zero.'),
  validate, controller.createFarmField);
router.get('/fields', controller.listFields);
router.get('/fields/:fieldId/yield-history', controller.fieldYieldHistory);
router.post('/crop-cycles',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('fieldId').isString().notEmpty().withMessage('fieldId is required.'),
  body('bomId').isString().notEmpty().withMessage('bomId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('cropName').isString().trim().notEmpty().withMessage('cropName is required.'),
  body('plantedDate').isISO8601().withMessage('plantedDate must be a valid date.'),
  body('expectedYield').isFloat({ gt: 0 }).withMessage('expectedYield must be greater than zero.'),
  validate, controller.startCropCycle);
router.get('/crop-cycles', controller.listCropCycles); // ?fieldId=&status=
router.post('/crop-cycles/:id/harvest',
  body('actualYield').isFloat({ gt: 0 }).withMessage('actualYield must be greater than zero.'),
  validate, controller.completeHarvest);

module.exports = router;
