const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/contractController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('title').isString().notEmpty().withMessage('title is required.'),
  body('contractType').isIn(['customer', 'supplier', 'lease', 'employment', 'nda', 'service_agreement', 'other']).withMessage('Invalid contractType.'),
  body('counterpartyName').isString().notEmpty().withMessage('counterpartyName is required.'),
  body('startDate').notEmpty().withMessage('startDate is required.'),
  body('endDate').notEmpty().withMessage('endDate is required.'),
  validate, requirePermission('contracts.manage'), controller.createContract);

router.get('/', controller.listContracts); // ?status=&contractType=&expiringWithinDays=
router.get('/expiring', controller.expiringContracts); // ?withinDays=
router.get('/:id', controller.getContract);

router.put('/:id', requirePermission('contracts.manage'), controller.updateContract);
router.post('/:id/activate', requirePermission('contracts.manage'), controller.activateContract);
router.post('/:id/terminate',
  body('terminationReason').isString().notEmpty().withMessage('terminationReason is required.'),
  validate, requirePermission('contracts.manage'), controller.terminateContract);
router.post('/:id/renew',
  body('startDate').notEmpty().withMessage('startDate is required.'),
  body('endDate').notEmpty().withMessage('endDate is required.'),
  validate, requirePermission('contracts.manage'), controller.renewContract);

module.exports = router;
