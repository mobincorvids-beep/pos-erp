const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ECOMMERCE_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/productChannelController');

router.use(requireAuth, scopeToCompany);

// GET /products/:id/channel?channel=ecommerce — effective price/content for that channel
router.get('/:id/channel', controller.getEffective);
router.put('/:id/channel', requirePermission(ECOMMERCE_MANAGE), controller.setOverride);
router.delete('/:id/channel/:channel', requirePermission(ECOMMERCE_MANAGE), controller.clearOverride);

module.exports = router;
