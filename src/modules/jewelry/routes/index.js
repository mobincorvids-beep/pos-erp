const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/jewelryController');

router.use(requireAuth, scopeToCompany);

router.use(requireActiveModule('jewelry'));

router.get('/gold-rates', controller.currentRates);
router.post('/gold-rates',
  body('karat').isFloat({ gt: 0 }).withMessage('karat is required.'),
  body('ratePerGram').isFloat({ gt: 0 }).withMessage('ratePerGram must be greater than zero.'),
  validate, controller.setRate);

router.post('/items/config',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('karat').isFloat({ gt: 0 }).withMessage('karat is required.'),
  validate, controller.configureItem);
router.get('/items/:variantId/quote', controller.quote);

router.post('/buybacks',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('karat').isFloat({ gt: 0 }).withMessage('karat is required.'),
  body('weightGrams').isFloat({ gt: 0 }).withMessage('weightGrams must be greater than zero.'),
  validate, controller.intakeBuyback);
router.post('/buybacks/:id/apply', body('saleId').isString().notEmpty().withMessage('saleId is required.'), validate, controller.markBuybackApplied);
router.post('/buybacks/:id/cancel', controller.cancelBuyback);
router.get('/customers/:customerId/buybacks', controller.customerBuybacks);

module.exports = router;
