const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { CRM_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/crmController');
const pipelineController = require('../controllers/crmPipelineController');

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

// --- Sales pipeline: Leads --------------------------------------------------
// Working leads day-to-day is routine front-line work (like feedback/
// follow-ups above) — left open, but converting a lead into a real
// Customer is gated the same as every other data-creating CRM action.
router.get('/leads', pipelineController.listLeads); // ?status=new|contacted|qualified|unqualified|converted
router.post('/leads',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('source').optional().isIn(['website', 'referral', 'walk-in', 'social', 'other']).withMessage('Invalid source.'),
  validate, pipelineController.createLead);
router.get('/leads/:id', pipelineController.getLead);
router.post('/leads/:id/status',
  body('status').isIn(['new', 'contacted', 'qualified', 'unqualified']).withMessage('Invalid status.'),
  validate, pipelineController.updateLeadStatus);
router.post('/leads/:id/convert', requirePermission(CRM_MANAGE), pipelineController.convertLead);

// --- Sales pipeline: Opportunities ------------------------------------------
router.get('/pipeline', pipelineController.pipeline); // kanban shape: { new: [...], contacted: [...], ... }
router.get('/pipeline/summary', pipelineController.pipelineSummary); // ?days=90
router.get('/opportunities', pipelineController.listOpportunities); // ?stage=...
router.post('/opportunities', requirePermission(CRM_MANAGE),
  body('title').isString().trim().notEmpty().withMessage('title is required.'),
  body('estimatedValue').isFloat({ min: 0 }).withMessage('estimatedValue must be a non-negative number.'),
  validate, pipelineController.createOpportunity);
router.get('/opportunities/:id', pipelineController.getOpportunity);
router.post('/opportunities/:id/stage', requirePermission(CRM_MANAGE),
  body('stage').isIn(['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost']).withMessage('Invalid stage.'),
  validate, pipelineController.updateOpportunityStage);

module.exports = router;
