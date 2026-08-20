const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/sizeCurveController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('footwear'));

router.get('/size-curves', controller.listCurves);
router.post('/size-curves',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('ratios').isArray({ min: 1 }).withMessage('At least one ratio is required.'),
  body('ratios.*.sizeLabel').isString().trim().notEmpty().withMessage('Each ratio needs a sizeLabel.'),
  body('ratios.*.percent').isFloat({ gt: 0 }).withMessage('Each ratio needs a percent greater than zero.'),
  validate, controller.createCurve);
router.post('/size-curves/:id/apply',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('totalQuantity').isInt({ gt: 0 }).withMessage('totalQuantity must be a positive whole number.'),
  validate, controller.applyCurve);

module.exports = router;
