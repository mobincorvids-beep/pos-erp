const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/funnelController');

// Authenticated staff CRUD + analytics. Mounted at /funnels (see
// src/routes/index.js) — NOT to be confused with the separate public
// router in publicFunnelRoutes.js (mounted at /public/funnels), which has
// no auth at all since a customer visiting a landing page has no login.
router.use(requireAuth, scopeToCompany);

router.get('/', controller.listFunnels);
router.post('/',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  validate, requirePermission('funnels.manage'), controller.createFunnel);
router.get('/:id', controller.getFunnel);
router.put('/:id', requirePermission('funnels.manage'), controller.updateFunnel);
router.post('/:id/publish', requirePermission('funnels.manage'), controller.publishFunnel);
router.get('/:id/analytics', controller.analytics);

module.exports = router;
