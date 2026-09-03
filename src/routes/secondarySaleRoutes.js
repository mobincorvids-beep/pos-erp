const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SECONDARY_SALES_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/secondarySaleController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list);
router.get('/summary', controller.summary); // ?period=2026-08 — must be before any /:id-style route to avoid collision
router.post('/',
  requirePermission(SECONDARY_SALES_MANAGE),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('period').isString().notEmpty().withMessage('period is required.'),
  body('quantitySold').isFloat({ min: 0 }).withMessage('quantitySold must be zero or greater.'),
  validate, controller.upsert);
router.delete('/:id', requirePermission(SECONDARY_SALES_MANAGE), controller.remove);

module.exports = router;
