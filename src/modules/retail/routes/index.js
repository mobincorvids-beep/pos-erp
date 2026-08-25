const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/layawayController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('retail'));

router.post('/layaway',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('totalPrice').isFloat({ gt: 0 }).withMessage('totalPrice must be greater than zero.'),
  body('depositLiabilityAccountId').isString().notEmpty().withMessage('depositLiabilityAccountId is required.'),
  validate, controller.createPlan);
router.get('/layaway', controller.listPlans); // ?status=&customerId=
router.post('/layaway/:id/payments',
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.makePayment);
router.post('/layaway/:id/cancel', controller.cancelPlan);
router.put('/layaway/:id',
  body('totalPrice').optional().isFloat({ gt: 0 }).withMessage('totalPrice must be greater than zero.'),
  body('quantity').optional().isInt({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  validate, controller.updatePlan);

module.exports = router;
