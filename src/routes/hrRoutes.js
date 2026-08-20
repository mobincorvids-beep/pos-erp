const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { HR_MANAGE, PAYROLL_POST } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/hrController');

router.use(requireAuth, scopeToCompany);

router.get('/employees', controller.listEmployees);
router.post('/employees', requirePermission(HR_MANAGE), body('name').isString().trim().notEmpty().withMessage('Name is required.'), validate, controller.createEmployee);
router.post('/employees/:id/terminate', requirePermission(HR_MANAGE), controller.terminateEmployee);

router.post('/attendance', requirePermission(HR_MANAGE), controller.markAttendance); // { employeeId, date, status, checkIn?, checkOut?, note? }
router.get('/attendance/:employeeId', controller.attendanceForMonth); // ?month=&year=

router.get('/leave-requests', controller.listLeaveRequests); // ?status=
router.post('/leave-requests', controller.requestLeave);      // an employee/their manager requesting — left open like expense submission
router.post('/leave-requests/:id/decide', requirePermission(HR_MANAGE), controller.decideLeave); // { approve }

router.get('/payroll-runs', requirePermission(HR_MANAGE), controller.listPayrollRuns);
router.get('/payroll-runs/:id', requirePermission(HR_MANAGE), controller.getPayrollRun);
router.post('/payroll-runs', requirePermission(HR_MANAGE),
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be 1-12.'),
  body('year').isInt({ min: 2000 }).withMessage('year must be a valid year.'),
  validate, controller.generatePayroll);
router.post('/payroll-runs/:id/post', requirePermission(PAYROLL_POST),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.postPayroll); // separate, stricter permission: generating a draft isn't the same as authorizing money to leave the account

module.exports = router;
