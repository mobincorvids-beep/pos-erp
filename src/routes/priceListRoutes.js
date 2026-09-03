const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PRICE_LISTS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/priceListController');

const upsertValidation = [
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('entries').optional().isArray(),
];

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', requirePermission(PRICE_LISTS_MANAGE), upsertValidation, validate, controller.create);
router.put('/:id', requirePermission(PRICE_LISTS_MANAGE), upsertValidation, validate, controller.update);
router.delete('/:id', requirePermission(PRICE_LISTS_MANAGE), controller.remove);
router.post('/quote',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  validate, controller.quote);

module.exports = router;
