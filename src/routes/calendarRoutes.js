const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/calendarController');

router.use(requireAuth, scopeToCompany);

router.get('/events', controller.listEvents); // ?from=&to=
router.post('/events',
  body('title').isString().trim().notEmpty().withMessage('title is required.'),
  body('startTime').isISO8601().withMessage('startTime must be a valid date/time.'),
  body('endTime').isISO8601().withMessage('endTime must be a valid date/time.'),
  validate, controller.createEvent);
router.put('/events/:id',
  body('startTime').optional().isISO8601().withMessage('startTime must be a valid date/time.'),
  body('endTime').optional().isISO8601().withMessage('endTime must be a valid date/time.'),
  validate, controller.updateEvent);
router.post('/events/:id/respond',
  body('response').isIn(['accepted', 'declined']).withMessage('response must be "accepted" or "declined".'),
  validate, controller.respondToEvent);
router.post('/events/:id/cancel', controller.cancelEvent);

module.exports = router;
