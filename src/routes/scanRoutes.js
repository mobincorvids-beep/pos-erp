const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/scanController');

// NOT wired into src/routes/index.js yet — see the report accompanying this
// file for the exact `app.use('/warehouse/scan', require('./scanRoutes'))`
// line to add. Deliberately no requirePermission gate beyond normal auth —
// these are read-only lookups (resolve-product/resolve-bin) or delegate
// straight into pickWaveService.recordPick's own guards (pick-confirm), a
// scanner UI used by regular pick-floor staff, same access level as
// PickWave's own pick endpoint.

router.use(requireAuth, scopeToCompany);

router.post('/resolve-product',
  body('code').isString().notEmpty().withMessage('code is required.'),
  validate, controller.resolveProduct);

router.post('/resolve-bin',
  body('binCode').isString().notEmpty().withMessage('binCode is required.'),
  body('warehouseId').optional().isString(),
  validate, controller.resolveBin);

router.post('/pick-wave-lines/:lineId/confirm-pick',
  body('productCode').isString().notEmpty().withMessage('productCode is required.'),
  body('binCode').isString().notEmpty().withMessage('binCode is required.'),
  body('quantityPicked').isFloat({ gt: 0 }).withMessage('quantityPicked must be greater than zero.'),
  validate, controller.confirmPick);

module.exports = router;
