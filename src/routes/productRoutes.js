const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/productController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.deactivate);
router.post('/:id/variants', controller.addVariant);
router.put('/:id/variants/:variantId', controller.updateVariant);
router.delete('/:id/variants/:variantId', controller.deactivateVariant);
router.get('/barcode/:barcode', controller.findByBarcode);
router.get('/batches', controller.listBatches); // ?productId=

module.exports = router;
