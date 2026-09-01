const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/qualityController');

router.use(requireAuth, scopeToCompany);

router.post('/ncrs',
  requirePermission('quality.manage'),
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('title').isString().trim().notEmpty().withMessage('title is required.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  body('source').isIn(['customer_complaint', 'internal_inspection', 'supplier_defect', 'production_defect', 'other']).withMessage('Invalid source.'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity.'),
  validate, controller.createNCR);
router.get('/ncrs', controller.listNCRs); // ?status=&severity=&source=
router.get('/ncrs/summary', controller.ncrSummary); // ?from=&to=
router.get('/ncrs/:id', controller.getNCR);
router.post('/ncrs/:id/root-cause',
  requirePermission('quality.manage'),
  body('rootCause').isString().trim().notEmpty().withMessage('rootCause is required.'),
  validate, controller.setRootCause);
router.post('/ncrs/:id/status',
  requirePermission('quality.manage'),
  body('status').isIn(['investigating', 'corrective_action', 'closed']).withMessage('Invalid status.'),
  validate, controller.updateNCRStatus);

router.post('/ncrs/:id/actions',
  requirePermission('quality.manage'),
  body('actionType').isIn(['corrective', 'preventive']).withMessage('actionType must be corrective or preventive.'),
  body('description').isString().trim().notEmpty().withMessage('description is required.'),
  validate, controller.createCorrectiveAction);
router.get('/ncrs/:id/actions', controller.listCorrectiveActions);
router.post('/actions/:actionId/status',
  requirePermission('quality.manage'),
  body('status').isIn(['in_progress', 'completed', 'verified']).withMessage('Invalid status.'),
  validate, controller.updateCorrectiveActionStatus);

module.exports = router;
