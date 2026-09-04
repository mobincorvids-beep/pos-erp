const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PURCHASE_CREATE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/vmiController');

router.use(requireAuth, scopeToCompany, requirePermission(PURCHASE_CREATE));

router.get('/agreements', controller.listAgreements); // ?supplierId= &warehouseId=
router.post('/agreements',
  body('supplierId').notEmpty(), body('warehouseId').notEmpty(), body('productId').notEmpty(),
  body('minQty').isFloat({ min: 0 }), body('maxQty').isFloat({ min: 0 }), body('unitCost').isFloat({ min: 0 }),
  validate, controller.createAgreement);
router.patch('/agreements/:id/active', body('isActive').isBoolean(), validate, controller.setAgreementActive);

router.get('/proposals', controller.listProposals); // ?supplierId= &status=
router.post('/proposals/:id/reject', controller.rejectProposal);
router.post('/proposals/:id/convert', controller.convertProposal);

module.exports = router;
