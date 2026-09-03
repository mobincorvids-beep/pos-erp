const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/batchTraceabilityController');

router.use(requireAuth, scopeToCompany);

router.get('/:batchId/genealogy', controller.getGenealogy);

module.exports = router;
