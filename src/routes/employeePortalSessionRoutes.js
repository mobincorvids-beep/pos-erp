const router = require('express').Router();
const { body } = require('express-validator');
const { requireEmployeePortalAuth } = require('../middleware/employeePortalAuth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/employeePortalController');

// Unauthenticated — activating an invite and logging in are how an
// employee-portal session BEGINS, so neither can require one first.
router.post('/activate',
  body('inviteToken').isString().notEmpty().withMessage('inviteToken is required.'),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
  validate, controller.activateInvite);
router.post('/login',
  body('email').isEmail().withMessage('A valid email is required.'),
  body('password').isString().notEmpty().withMessage('password is required.'),
  validate, controller.login);
router.post('/refresh', body('refreshToken').isString().notEmpty().withMessage('refreshToken is required.'), validate, controller.refresh);

// Everything below requires a real employee-portal session.
router.use(requireEmployeePortalAuth);
router.get('/dashboard', controller.dashboard);
router.get('/attendance', controller.myAttendance); // ?month=&year=
router.get('/payslips', controller.myPayslips);
router.get('/leave-requests', controller.myLeaveRequests);
router.post('/leave-requests',
  body('fromDate').isString().notEmpty().withMessage('fromDate is required.'),
  body('toDate').isString().notEmpty().withMessage('toDate is required.'),
  validate, controller.requestLeave);
router.get('/profile', controller.getProfile);
router.patch('/profile', controller.updateProfile);

module.exports = router;
