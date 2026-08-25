const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/furnitureController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('furniture'));

router.post('/orders',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('promisedDeliveryDate').isISO8601().withMessage('promisedDeliveryDate must be a valid date.'),
  body('price').isFloat({ gt: 0 }).withMessage('price must be greater than zero.'),
  validate, controller.placeOrder);
router.get('/orders', controller.listOrders); // ?status=&customerId=
router.put('/orders/:id', controller.updateOrder);
router.post('/orders/:id/cancel', controller.cancelOrder);
router.post('/orders/:id/start-production', body('bomId').isString().notEmpty().withMessage('bomId is required.'), validate, controller.startProduction);
router.post('/orders/:id/mark-ready', controller.markReady);
router.post('/orders/:id/deliver', body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'), validate, controller.deliver);

router.get('/on-time-delivery-rate', controller.onTimeDeliveryRate);

module.exports = router;
