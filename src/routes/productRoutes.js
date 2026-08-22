const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/productController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', controller.create);
router.get('/barcode/:barcode', controller.findByBarcode);
router.get('/batches', controller.listBatches); // ?productId=

module.exports = router;
