const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/employeeLoanController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('principalAmount').isFloat({ gt: 0 }).withMessage('principalAmount must be greater than zero.'),
  body('monthlyInstallment').isFloat({ gt: 0 }).withMessage('monthlyInstallment must be greater than zero.'),
  body('loanReceivableAccountId').isString().notEmpty().withMessage('loanReceivableAccountId is required.'),
  body('disbursingAccountId').isString().notEmpty().withMessage('disbursingAccountId is required.'),
  validate, controller.disburseLoan);
router.get('/', controller.listLoans); // ?employeeId=&status=
router.post('/:employeeId/repay',
  body('amount').isFloat({ gt: 0 }).withMessage('amount must be greater than zero.'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('salaryPayableAccountId').isString().notEmpty().withMessage('salaryPayableAccountId is required.'),
  validate, controller.recordRepayment);

module.exports = router;
