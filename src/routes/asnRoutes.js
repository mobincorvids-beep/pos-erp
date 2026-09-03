const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PURCHASE_RECEIVE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/asnController');

// NOT wired into src/routes/index.js yet — see the report accompanying this
// file for the exact `app.use('/asns', require('./asnRoutes'))` line to add.

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?supplierId=&purchaseOrderId=&status=
router.get('/:id', controller.get);

router.post('/',
  requirePermission(PURCHASE_RECEIVE),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('purchaseOrderId').optional().isString(),
  body('expectedItems').isArray({ min: 1 }).withMessage('At least one expected item is required.'),
  body('expectedArrivalDate').optional().isISO8601(),
  validate, controller.create);

// Matches an already-posted GRN against this ASN and flags over/under
// variances; does not require or alter any receiving flow.
router.post('/:id/match-grn',
  requirePermission(PURCHASE_RECEIVE),
  body('grnId').isString().notEmpty().withMessage('grnId is required.'),
  validate, controller.matchGrn);

module.exports = router;
