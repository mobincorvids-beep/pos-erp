const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { SUPPLIER_ONBOARDING_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/supplierOnboardingController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.list); // ?status=
router.get('/:id', controller.get);
router.put('/:id/checklist', requirePermission(SUPPLIER_ONBOARDING_MANAGE), controller.setChecklist); // { labels: [...] }
router.post('/:id/documents', requirePermission(SUPPLIER_ONBOARDING_MANAGE), controller.submitDocument); // { label, documentId }
router.post('/:id/submit', requirePermission(SUPPLIER_ONBOARDING_MANAGE), controller.submitForReview);
router.post('/:id/decide', requirePermission(SUPPLIER_ONBOARDING_MANAGE), controller.decide); // { approve, note }

module.exports = router;
