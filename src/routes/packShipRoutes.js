const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { WAREHOUSE_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/packShipController');

// NOT wired into src/routes/index.js yet — see the report accompanying this
// file for the exact `app.use('/pack-ship', require('./packShipRoutes'))`
// line to add.

router.use(requireAuth, scopeToCompany);

router.get('/pick-waves/:pickWaveId/shipments', controller.listByPickWave);
router.get('/:id', controller.get);

router.post('/',
  requirePermission(WAREHOUSE_MANAGE),
  body('pickWaveId').isString().notEmpty().withMessage('pickWaveId is required.'),
  body('carrierName').optional().isString(),
  body('trackingNumber').optional().isString(),
  validate, controller.create);

router.post('/:id/pack', requirePermission(WAREHOUSE_MANAGE), controller.pack);
router.post('/:id/ship',
  requirePermission(WAREHOUSE_MANAGE),
  body('carrierName').optional().isString(),
  body('trackingNumber').optional().isString(),
  validate, controller.ship);
router.post('/:id/deliver',
  requirePermission(WAREHOUSE_MANAGE),
  body('podNote').optional().isString(),
  validate, controller.deliver);

module.exports = router;
