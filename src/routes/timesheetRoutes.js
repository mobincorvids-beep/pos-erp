const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/timesheetController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('employeeId').isString().notEmpty().withMessage('employeeId is required.'),
  body('date').isString().notEmpty().withMessage('date is required.'),
  body('hours').isFloat({ gt: 0 }).withMessage('hours must be greater than zero.'),
  validate, controller.logTime);

router.get('/', controller.listTimesheets); // ?employeeId=&projectId=&status=&from=&to=
router.get('/:id', controller.getTimesheet);
router.put('/:id', controller.updateTimesheet);
router.delete('/:id', controller.deleteTimesheet);

router.post('/:id/submit', controller.submitTimesheet);
router.post('/:id/approve', requirePermission('hr.manage'), controller.approveTimesheet);
router.post('/:id/reject', requirePermission('hr.manage'), controller.rejectTimesheet);

module.exports = router;
