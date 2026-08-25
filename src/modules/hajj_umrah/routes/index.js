const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/pilgrimageController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('hajj_umrah'));

router.post('/groups',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('packageName').isString().trim().notEmpty().withMessage('packageName is required.'),
  body('departureDate').isISO8601().withMessage('departureDate must be a valid date.'),
  body('capacity').isInt({ gt: 0 }).withMessage('capacity must be greater than zero.'),
  body('packagePrice').isFloat({ gt: 0 }).withMessage('packagePrice must be greater than zero.'),
  validate, controller.createGroup);
router.get('/groups', controller.listGroups); // ?status=
router.put('/groups/:groupId',
  body('departureDate').optional().isISO8601().withMessage('departureDate must be a valid date.'),
  body('capacity').optional().isInt({ gt: 0 }).withMessage('capacity must be greater than zero.'),
  body('packagePrice').optional().isFloat({ gt: 0 }).withMessage('packagePrice must be greater than zero.'),
  validate, controller.updateGroup);
router.post('/groups/:groupId/enroll',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('depositLiabilityAccountId').isString().notEmpty().withMessage('depositLiabilityAccountId is required.'),
  validate, controller.enroll);
router.post('/groups/:groupId/customers/:customerId/cancel', controller.cancelEnrollment);
router.post('/payments/:paymentId/pay',
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.makePayment);
router.get('/payments', controller.listPayments); // ?groupId=&customerId=

module.exports = router;
