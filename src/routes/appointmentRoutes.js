const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/appointmentController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);                  // ?staffUserId=...&status=...
router.get('/schedule', controller.schedule);       // ?staffUserId=...&from=...&to=...
router.post('/',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('staffUserId').isString().notEmpty().withMessage('staffUserId is required.'),
  body('serviceName').isString().trim().notEmpty().withMessage('serviceName is required.'),
  body('startTime').isISO8601().withMessage('startTime must be a valid date/time.'),
  body('endTime').isISO8601().withMessage('endTime must be a valid date/time.'),
  validate, controller.book);
router.patch('/:id/reschedule',
  body('startTime').isISO8601().withMessage('startTime must be a valid date/time.'),
  body('endTime').isISO8601().withMessage('endTime must be a valid date/time.'),
  validate, controller.reschedule);
router.patch('/:id/status', body('status').isString().notEmpty().withMessage('status is required.'), validate, controller.updateStatus);
router.post('/:id/bill', controller.bill);           // checks out a sale and links it back

module.exports = router;
