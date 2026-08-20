const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/gymController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('gym'));

router.get('/classes', controller.listClasses); // ?branchId=
router.post('/classes',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('capacity').isInt({ gt: 0 }).withMessage('capacity must be greater than zero.'),
  validate, controller.createClass);

router.get('/sessions', controller.listSessions); // ?gymClassId=
router.post('/classes/:classId/sessions', body('startTime').isISO8601().withMessage('startTime must be a valid date/time.'), validate, controller.scheduleSession);
router.get('/sessions/:sessionId/roster', controller.sessionRoster);
router.post('/sessions/:sessionId/enroll', body('customerId').isString().notEmpty().withMessage('customerId is required.'), validate, controller.enroll);
router.post('/sessions/:sessionId/cancel', body('customerId').isString().notEmpty().withMessage('customerId is required.'), validate, controller.cancelEnrollment);

module.exports = router;
