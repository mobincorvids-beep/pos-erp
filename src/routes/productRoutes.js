const router = require('express').Router();
const multer = require('multer');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/productController');

// In-memory storage — the CSV is parsed immediately and never needs to touch
// disk. 5MB is generously more than a multi-thousand-row product catalog needs.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/import-csv', upload.single('file'), controller.importCsv);
router.put('/:id', controller.update);
router.delete('/:id', controller.deactivate);
router.post('/:id/variants', controller.addVariant);
router.put('/:id/variants/:variantId', controller.updateVariant);
router.delete('/:id/variants/:variantId', controller.deactivateVariant);
router.get('/barcode/:barcode', controller.findByBarcode);
router.get('/batches', controller.listBatches); // ?productId=

module.exports = router;
