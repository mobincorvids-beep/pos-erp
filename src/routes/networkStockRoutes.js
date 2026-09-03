const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/networkStockController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.getView); // ?productId= (omit for all products)

module.exports = router;
