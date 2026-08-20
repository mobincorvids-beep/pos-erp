const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/hospitalController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('hospital'));

router.post('/visits/check-in',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  validate, controller.checkIn);
router.get('/visits/queue', controller.currentQueue); // ?branchId=
router.post('/visits/call-next', body('branchId').isString().notEmpty().withMessage('branchId is required.'), validate, controller.callNext);
router.get('/visits', controller.listVisits); // ?branchId=&status=
router.post('/visits/:id/complete',
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  validate, controller.completeVisit);
router.post('/visits/:id/cancel', controller.cancelVisit);

module.exports = router;
