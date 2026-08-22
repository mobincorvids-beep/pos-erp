const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/insuranceController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('insurance'));

router.post('/policies',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('policyType').isString().trim().notEmpty().withMessage('policyType is required.'),
  body('coverageAmount').isFloat({ gt: 0 }).withMessage('coverageAmount must be greater than zero.'),
  body('premiumAmount').isFloat({ gt: 0 }).withMessage('premiumAmount must be greater than zero.'),
  body('startDate').isISO8601().withMessage('startDate must be a valid date.'),
  body('endDate').isISO8601().withMessage('endDate must be a valid date.'),
  body('billingProductId').isString().notEmpty().withMessage('billingProductId is required.'),
  body('billingVariantId').isString().notEmpty().withMessage('billingVariantId is required.'),
  validate, controller.sellPolicy);
router.get('/policies', controller.listPolicies); // ?customerId=&status=
router.post('/policies/:policyId/claims',
  body('claimAmount').isFloat({ gt: 0 }).withMessage('claimAmount must be greater than zero.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  validate, controller.submitClaim);
router.post('/claims/:claimId/decide', body('approve').isBoolean().withMessage('approve must be a boolean.'), validate, controller.decideClaim);
router.get('/claims', controller.listClaims); // ?policyId=&status=

module.exports = router;
