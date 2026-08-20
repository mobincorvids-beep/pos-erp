const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/expenseCategoryController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', controller.create);

module.exports = router;
