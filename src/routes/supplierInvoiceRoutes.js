const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ACCOUNTS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/supplierInvoiceController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?purchaseOrderId=&supplierId=&matchStatus=
router.get('/:id', controller.get);

router.post('/',
  requirePermission(ACCOUNTS_MANAGE),
  body('purchaseOrderId').isString().notEmpty().withMessage('purchaseOrderId is required.'),
  body('supplierInvoiceNumber').isString().notEmpty().withMessage('supplierInvoiceNumber is required.'),
  body('items').isArray({ min: 1 }).withMessage('items must be a non-empty array.'),
  body('totalAmount').isFloat({ gt: 0 }).withMessage('totalAmount must be greater than zero.'),
  validate, controller.create); // runs the three-way match immediately on creation

router.post('/:id/rematch', requirePermission(ACCOUNTS_MANAGE), controller.rematch);
router.post('/:id/approve', requirePermission(ACCOUNTS_MANAGE), controller.approve);
router.post('/:id/reject',
  requirePermission(ACCOUNTS_MANAGE),
  body('reason').optional().isString(),
  validate, controller.reject);

module.exports = router;
