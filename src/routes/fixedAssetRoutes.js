const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ACCOUNTS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/fixedAssetController');

router.use(requireAuth, scopeToCompany, requirePermission(ACCOUNTS_MANAGE));

router.post('/',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('assetAccountId').isString().notEmpty().withMessage('assetAccountId is required.'),
  body('depreciationExpenseAccountId').isString().notEmpty().withMessage('depreciationExpenseAccountId is required.'),
  body('accumulatedDepreciationAccountId').isString().notEmpty().withMessage('accumulatedDepreciationAccountId is required.'),
  body('purchaseDate').isISO8601().withMessage('purchaseDate must be a valid date.'),
  body('purchaseCost').isFloat({ gt: 0 }).withMessage('purchaseCost must be greater than zero.'),
  body('usefulLifeMonths').isInt({ gt: 0 }).withMessage('usefulLifeMonths must be greater than zero.'),
  validate, controller.registerAsset);
router.get('/', controller.listAssets); // ?status=&category=&assignedToEmployeeId=
router.post('/:id/depreciate', body('period').isString().trim().notEmpty().withMessage('period is required (e.g. "2026-08").'), validate, controller.runDepreciation);
router.post('/:id/dispose', body('disposalProceeds').isFloat({ min: 0 }).withMessage('disposalProceeds is required.'), validate, controller.disposeAsset);
router.post('/:id/assign', body('employeeId').isString().notEmpty().withMessage('employeeId is required.'), validate, controller.assignAsset);
router.post('/:id/unassign', controller.unassignAsset);

module.exports = router;
