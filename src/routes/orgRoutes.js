const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ROLES_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/orgController');

router.use(requireAuth, scopeToCompany);

// Business/company profile — same admin tier as roles.manage (see webhookRoutes
// for precedent): every tenant user can read it, only an admin can change it.
router.get('/company', controller.getCompany);
router.put('/company', requirePermission(ROLES_MANAGE), controller.updateCompany);

// Multi-branch management.
router.get('/branches', controller.listBranches);
router.post('/branches', requirePermission(ROLES_MANAGE), controller.createBranch);
router.put('/branches/:id', requirePermission(ROLES_MANAGE), controller.updateBranch);
router.delete('/branches/:id', requirePermission(ROLES_MANAGE), controller.deactivateBranch);

router.get('/warehouses', controller.listWarehouses);   // ?branchId=...
router.get('/warehouses/:id/hierarchy', controller.warehouseHierarchy); // parent DC + child branches
router.get('/pos-terminals', controller.listPosTerminals); // ?branchId=...
router.get('/accounts', controller.listAccounts);        // ?paymentOnly=true&type=asset

module.exports = router;
