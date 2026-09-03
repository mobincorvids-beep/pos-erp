const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SCHEDULED_REPORTS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/scheduledReportController');

// Scheduled/emailed report definitions. Mount at '/scheduled-reports' in
// src/routes/index.js:
//   router.use('/scheduled-reports', require('./scheduledReportRoutes'));
// No cron/worker fires these automatically yet — see scheduledReportService
// for what's built (due-query + render/email) vs the scheduler trigger,
// which is a follow-up.
router.use(requireAuth, scopeToCompany, requirePermission(SCHEDULED_REPORTS_MANAGE));

router.get('/', controller.list);
router.post('/',
  body('reportType').isString().notEmpty().withMessage('reportType is required.'),
  body('frequency').isIn(['daily', 'weekly', 'monthly']).withMessage('frequency must be daily, weekly, or monthly.'),
  body('recipientEmails').isArray({ min: 1 }).withMessage('recipientEmails must be a non-empty array.'),
  validate, controller.create);
router.get('/due', controller.due); // what's due right now — the query a scheduler would poll
router.get('/:id', controller.get);
router.patch('/:id', controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/send', controller.send); // render + email now (manual trigger, or what a scheduler calls per due item)

module.exports = router;
