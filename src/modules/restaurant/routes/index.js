const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const tableController = require('../controllers/tableController');
const kotController = require('../controllers/kotController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('restaurant'));

router.get('/tables', tableController.list);
router.post('/tables', tableController.create);
router.put('/tables/:id', tableController.update);
router.patch('/tables/:id/status', tableController.updateStatus);
router.delete('/tables/:id', tableController.remove);

// Kitchen order tickets — was entirely missing (model existed, nothing used it).
router.get('/orders', kotController.list);
router.get('/orders/:id', kotController.get);
router.post('/orders', kotController.create);
router.post('/orders/:id/items', kotController.addItems);
router.patch('/orders/:id/items/:itemId/status', kotController.updateItemStatus);
router.post('/orders/:id/close', kotController.close);
router.delete('/orders/:id', kotController.cancel);

module.exports = router;
