const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/supplierScorecardController');

router.use(requireAuth, scopeToCompany);

router.get('/', controller.getAll); // ?from=&to= — ranked list across suppliers
router.get('/:id', controller.getOne); // ?from=&to=

module.exports = router;
