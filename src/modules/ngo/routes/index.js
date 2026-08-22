const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/fundController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('ngo'));

router.post('/funds',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('type').isIn(['restricted', 'unrestricted']).withMessage('type must be "restricted" or "unrestricted".'),
  validate, controller.createFund);
router.get('/funds', controller.listFunds); // ?type=
router.get('/funds/:fundId/ledger', controller.fundLedger);
router.post('/funds/:fundId/donations',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('receivingAccountId').isString().notEmpty().withMessage('receivingAccountId is required.'),
  body('donationRevenueAccountId').isString().notEmpty().withMessage('donationRevenueAccountId is required.'),
  validate, controller.recordDonation);
router.post('/funds/:fundId/disbursements',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  body('expenseAccountId').isString().notEmpty().withMessage('expenseAccountId is required.'),
  body('payingAccountId').isString().notEmpty().withMessage('payingAccountId is required.'),
  validate, controller.recordDisbursement);

module.exports = router;
