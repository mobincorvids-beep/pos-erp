const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ACCOUNTS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/currencyController');

router.use(requireAuth, scopeToCompany);

router.get('/supported', controller.listSupportedCurrencies); // which currencies Frankfurter actually covers, so the UI can tell a user upfront whether they'll need a manual rate
router.get('/rate', controller.getRate); // ?from=&to=&date= (date optional, defaults to today)
router.get('/convert', controller.convert); // ?amount=&from=&to=&date=
router.get('/rates', controller.listRates); // ?fromCurrency=&toCurrency=
router.post('/rates/manual',
  requirePermission(ACCOUNTS_MANAGE),
  body('fromCurrency').isString().trim().isLength({ min: 3, max: 3 }).withMessage('fromCurrency must be a 3-letter code.'),
  body('toCurrency').isString().trim().isLength({ min: 3, max: 3 }).withMessage('toCurrency must be a 3-letter code.'),
  body('rate').isFloat({ gt: 0 }).withMessage('rate must be greater than zero.'),
  validate, controller.setManualRate);

module.exports = router;
