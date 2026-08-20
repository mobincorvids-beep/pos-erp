const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/orgController');

router.use(requireAuth, scopeToCompany);
router.get('/branches', controller.listBranches);
router.get('/warehouses', controller.listWarehouses);   // ?branchId=...
router.get('/pos-terminals', controller.listPosTerminals); // ?branchId=...
router.get('/accounts', controller.listAccounts);        // ?paymentOnly=true&type=asset

module.exports = router;
