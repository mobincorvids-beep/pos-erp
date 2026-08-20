const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/shipmentController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('courier'));

router.post('/shipments',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('trackingNumber').isString().trim().notEmpty().withMessage('trackingNumber is required.'),
  validate, controller.createShipment);
router.get('/shipments', controller.listShipments); // ?status=&customerId=
router.get('/shipments/track/:trackingNumber', controller.trackByNumber);
router.post('/shipments/:id/advance', body('status').isString().notEmpty().withMessage('status is required.'), validate, controller.advanceStatus);
router.post('/shipments/:id/deliver', controller.markDelivered);

module.exports = router;
