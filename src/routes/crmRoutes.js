const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { CRM_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/crmController');

router.use(requireAuth, scopeToCompany);

router.get('/segments', controller.segment); // ?tags=VIP,Wholesale
router.post('/customers/:customerId/tags', body('tags').isArray({ min: 1 }).withMessage('tags must be a non-empty array.'), validate, controller.addTags);
router.delete('/customers/:customerId/tags', body('tags').isArray({ min: 1 }).withMessage('tags must be a non-empty array.'), validate, controller.removeTags);

// Feedback and follow-ups are routine front-line work — left open (no
// permission gate), but still shape-validated the same as everything else.
router.get('/feedback', controller.listFeedback); // ?status=open|acknowledged|resolved
router.post('/feedback',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('rating must be between 1 and 5.'),
  validate, controller.submitFeedback);
router.post('/feedback/:id/resolve', controller.resolveFeedback);

router.get('/follow-ups', controller.pendingFollowUps); // ?assignedToUserId=...
router.post('/follow-ups',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('dueDate').isISO8601().withMessage('dueDate must be a valid date.'),
  validate, controller.scheduleFollowUp);
router.post('/follow-ups/:id/complete', controller.completeFollowUp);

// Campaigns reach every customer matching a segment — gated.
router.get('/campaigns', controller.listCampaigns);
router.post('/campaigns', requirePermission(CRM_MANAGE),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('channel').isIn(['sms', 'email']).withMessage('channel must be "sms" or "email".'),
  body('message').isString().trim().notEmpty().withMessage('message is required.'),
  validate, controller.createCampaign);
router.post('/campaigns/:id/send', requirePermission(CRM_MANAGE), controller.sendCampaign);

module.exports = router;
