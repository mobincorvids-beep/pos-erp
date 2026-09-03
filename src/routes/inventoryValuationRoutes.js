const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/inventoryValuationController');

router.use(requireAuth, scopeToCompany);

router.get('/historical', controller.getHistorical); // ?asOfDate=&warehouseId=

module.exports = router;
