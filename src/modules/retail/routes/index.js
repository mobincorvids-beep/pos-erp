const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/layawayController');
const retailController = require('../controllers/retailController');

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

router.post('/promotions',
  body('name').isString().notEmpty().withMessage('name is required.'),
  body('type').isIn(['buy_x_get_y', 'bundle']).withMessage('type must be buy_x_get_y or bundle.'),
  validate, retailController.createPromotion);
router.get('/promotions', retailController.listPromotions); // ?branchId=&activeOnly=true
router.put('/promotions/:id/active', body('active').isBoolean().withMessage('active must be true or false.'), validate, retailController.setPromotionActive);
router.post('/promotions/evaluate-cart',
  body('items').isArray({ min: 1 }).withMessage('items is required.'),
  validate, retailController.evaluateCart);

router.get('/reports/supplier-scorecard', retailController.supplierScorecard); // ?fromDate=&toDate=

module.exports = router;
