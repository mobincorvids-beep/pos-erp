const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/warrantyController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('electronics'));

router.post('/warranties',
  body('serialNumber').isString().trim().notEmpty().withMessage('serialNumber is required.'),
  body('warrantyMonths').isInt({ gt: 0 }).withMessage('warrantyMonths must be greater than zero.'),
  validate, controller.registerWarranty);
router.get('/warranties/:serialNumber/check', controller.checkWarranty);
router.put('/warranties/:id',
  body('warrantyMonths').optional().isInt({ gt: 0 }).withMessage('warrantyMonths must be greater than zero.'),
  validate, controller.updateWarranty);

router.post('/warranties/:warrantyId/claims',
  body('issueDescription').isString().trim().notEmpty().withMessage('issueDescription is required.'),
  validate, controller.submitClaim);
router.get('/claims', controller.listClaims); // ?warrantyId=
router.post('/claims/:id/decide', body('approve').isBoolean().withMessage('approve must be true or false.'), validate, controller.decideClaim);
router.post('/claims/:id/repair-job',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('warehouseId').isString().notEmpty().withMessage('warehouseId is required.'),
  body('itemDescription').isString().trim().notEmpty().withMessage('itemDescription is required.'),
  validate, controller.linkRepairJob);
router.post('/claims/:id/resolve', controller.resolveClaim);

module.exports = router;
