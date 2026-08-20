const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/fuelShiftController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('petrol_pump'));

router.post('/dispensers',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  validate, controller.createDispenser);
router.get('/dispensers', controller.listDispensers);
router.post('/dispensers/:dispenserId/shifts/open', body('pricePerLitre').isFloat({ gt: 0 }).withMessage('pricePerLitre must be greater than zero.'), validate, controller.openShift);
router.get('/shifts', controller.listShifts);
router.post('/shifts/:id/close',
  body('closingReading').isFloat({ min: 0 }).withMessage('closingReading is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.closeShift);

module.exports = router;
