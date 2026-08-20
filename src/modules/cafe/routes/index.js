const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/cafeSubscriptionController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('cafe'));

router.post('/subscriptions',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('planName').isString().trim().notEmpty().withMessage('planName is required.'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date.'),
  body('subscriptionPrice').isFloat({ gt: 0 }).withMessage('subscriptionPrice must be greater than zero.'),
  body('subscriptionBillingProductId').isString().notEmpty().withMessage('subscriptionBillingProductId is required.'),
  body('redeemProductId').isString().notEmpty().withMessage('redeemProductId is required.'),
  validate, controller.sellSubscription);
router.get('/subscriptions', controller.listSubscriptions); // ?customerId=&status=
router.post('/subscriptions/:id/redeem', body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'), validate, controller.redeemDaily);

module.exports = router;
