const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/reviewRequestController');

// Authenticated staff side — send review requests, view sent ones, view
// the "needs follow-up" (rating < 4) dashboard list. Mounted at
// /review-requests (see src/routes/index.js) — the PUBLIC token-based
// side lives in publicReviewRoutes.js.
router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?status=
router.get('/needs-follow-up', controller.followUpList);
router.post('/',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  validate, requirePermission('marketing.manage'), controller.send);

module.exports = router;
