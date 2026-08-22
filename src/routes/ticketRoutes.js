const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/ticketController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('category').isString().trim().notEmpty().withMessage('category is required.'),
  body('subject').isString().trim().notEmpty().withMessage('subject is required.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  body('priority').isIn(['low', 'medium', 'high', 'emergency']).withMessage('priority must be low, medium, high, or emergency.'),
  validate, controller.createTicket);
router.get('/', controller.listTickets); // ?status=&priority=&assignedToUserId=&slaBreached=
router.post('/:id/assign', body('assignedToUserId').isString().notEmpty().withMessage('assignedToUserId is required.'), validate, controller.assignTicket);
router.post('/:id/resolve', body('resolutionNote').isString().trim().notEmpty().withMessage('resolutionNote is required.'), validate, controller.resolveTicket);
router.post('/:id/close', controller.closeTicket);
router.get('/sla/compliance', controller.slaComplianceReport);

module.exports = router;
