const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const controller = require('../controllers/fefoController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('grocery'));

router.get('/pick-order', controller.suggestPickOrder); // ?warehouseId=&variantId=&quantity=

module.exports = router;
