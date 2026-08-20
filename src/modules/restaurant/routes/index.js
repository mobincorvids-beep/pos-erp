const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const tableController = require('../controllers/tableController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('restaurant'));

router.get('/tables', tableController.list);
router.post('/tables', tableController.create);
router.patch('/tables/:id/status', tableController.updateStatus);

module.exports = router;
