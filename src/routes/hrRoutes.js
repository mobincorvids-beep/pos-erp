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
router.post('/employees/:id/manager', requirePermission(HR_MANAGE), controller.setManager); // { managerId } — managerId: null clears it
router.get('/org-chart', controller.orgChart);

router.post('/attendance', requirePermission(HR_MANAGE), controller.markAttendance); // { employeeId, date, status, checkIn?, checkOut?, note? }
router.get('/attendance/:employeeId', controller.attendanceForMonth); // ?month=&year=

router.get('/leave-requests', controller.listLeaveRequests); // ?status=  or ?pendingMyApproval=true (a manager's own team's pending requests)
router.post('/leave-requests', controller.requestLeave);      // an employee/their manager requesting — left open like expense submission
// Not gated by requirePermission(HR_MANAGE) at the router level: an HR
// manager OR the requester's own direct manager can decide — the
// controller checks that carve-out itself (hrService.isManagerOfEmployee).
router.post('/leave-requests/:id/decide', controller.decideLeave); // { approve }

router.get('/shifts', controller.listShifts);
router.post('/shifts', requirePermission(HR_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('startTime').isString().trim().notEmpty().withMessage('startTime is required.'),
  body('endTime').isString().trim().notEmpty().withMessage('endTime is required.'),
  validate, controller.createShift);
router.post('/shifts/assign', requirePermission(HR_MANAGE),
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  validate, controller.assignShift); // { employeeId, shiftId }

router.get('/leave-policies', controller.listLeavePolicies);
router.post('/leave-policies', requirePermission(HR_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  validate, controller.createLeavePolicy);

router.get('/leave-balances/:employeeId', controller.getLeaveBalances);

router.get('/payroll-runs', requirePermission(HR_MANAGE), controller.listPayrollRuns);
router.get('/payroll-runs/:id', requirePermission(HR_MANAGE), controller.getPayrollRun);
router.post('/payroll-runs', requirePermission(HR_MANAGE),
  body('month').isInt({ min: 1, max: 12 }).withMessage('month must be 1-12.'),
  body('year').isInt({ min: 2000 }).withMessage('year must be a valid year.'),
  validate, controller.generatePayroll);
router.post('/payroll-runs/:id/post', requirePermission(PAYROLL_POST),
  body('paymentAccountId').isString().notEmpty().withMessage('paymentAccountId is required.'),
  validate, controller.postPayroll); // separate, stricter permission: generating a draft isn't the same as authorizing money to leave the account

// --- Self-service ("My HR") --------------------------------------------
// Open to ANY authenticated user (no HR_MANAGE gate) — each endpoint
// resolves the caller's own Employee record server-side (Employee.userId)
// and only ever returns/acts on that record. A user with no linked
// Employee gets a clean 404, not someone else's data.
router.get('/me', controller.myEmployee);
router.get('/me/leave-balances', controller.myLeaveBalances);
router.get('/me/attendance', controller.myAttendance); // ?month=&year=
router.get('/me/leave-requests', controller.myLeaveRequests);
router.post('/me/leave-requests', controller.myRequestLeave); // { fromDate, toDate, type, reason, leavePolicyId }
router.get('/me/payslips', controller.myPayslips);

// --- Disciplinary / grievance records (HR_MANAGE only) ------------------
router.get('/disciplinary-cases/:employeeId', requirePermission(HR_MANAGE), controller.listDisciplinaryCases);
router.post('/disciplinary-cases', requirePermission(HR_MANAGE),
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('type').isIn(['warning', 'grievance', 'incident']).withMessage('type must be warning, grievance, or incident.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  validate, controller.createDisciplinaryCase);
router.post('/disciplinary-cases/:id/resolve', requirePermission(HR_MANAGE), controller.resolveDisciplinaryCase);

module.exports = router;
