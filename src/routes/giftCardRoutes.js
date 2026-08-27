const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/giftCardController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('initialBalance').isFloat({ gt: 0 }).withMessage('initialBalance must be greater than zero.'),
  body('customerId').optional().isString(),
  body('expiresAt').optional().isISO8601().withMessage('expiresAt must be a valid date.'),
  validate, controller.issue);

router.get('/', controller.list); // ?status=&customerId=
router.get('/:cardNumber/lookup', controller.lookup);
router.get('/:id/transactions', controller.transactions);

router.post('/:cardNumber/redeem',
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('saleId').optional().isString(),
  validate, controller.redeem);

module.exports = router;
