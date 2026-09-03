const router = require('express').Router();
const { requirePortalAuth } = require('../middleware/portalAuth');
const controller = require('../controllers/cartController');

router.use(requirePortalAuth);

router.get('/', controller.getCart);
router.post('/items', controller.addItem);       // { productId, variantId?, quantity? }
router.put('/items', controller.updateItem);      // { productId, variantId?, quantity } — quantity <= 0 removes the line
router.delete('/', controller.clear);

module.exports = router;
