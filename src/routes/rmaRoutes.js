const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { RMA_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/rmaController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.listRMAs); // ?status=&saleId=&customerId=
router.get('/:id', controller.getRMA);

router.post('/',
  body('saleId').isString().notEmpty().withMessage('saleId is required.'),
  body('items').isArray({ min: 1 }).withMessage('items must contain at least one entry.'),
  validate, controller.createRMA);

router.post('/:id/approve', requirePermission(RMA_MANAGE), controller.approve);
router.post('/:id/reject', requirePermission(RMA_MANAGE), controller.reject);
router.post('/:id/receive',
  requirePermission(RMA_MANAGE),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.receive);
router.post('/:id/refund', requirePermission(RMA_MANAGE), controller.refund);

module.exports = router;
