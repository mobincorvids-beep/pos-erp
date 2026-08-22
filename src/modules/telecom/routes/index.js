const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/telecomController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('telecom'));

router.post('/plans',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('monthlyFee').isFloat({ gt: 0 }).withMessage('monthlyFee must be greater than zero.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  body('overageBillingProductId').isString().notEmpty().withMessage('overageBillingProductId is required.'),
  body('overageBillingVariantId').isString().notEmpty().withMessage('overageBillingVariantId is required.'),
  validate, controller.createPlan);
router.get('/plans', controller.listPlans);
router.post('/subscriptions',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('planId').isString().notEmpty().withMessage('planId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.subscribeCustomer);
router.get('/subscriptions', controller.listSubscriptions); // ?customerId=&status=
router.post('/subscriptions/:id/usage', controller.recordUsage); // { minutes?, dataMB?, sms? }
router.post('/subscriptions/:id/bill',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.generateMonthlyBill);

module.exports = router;
