const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/requisitionController');

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', controller.create);
router.post('/:id/decide', controller.decide); // { approve: true|false }
router.post('/:id/quotes', controller.submitQuote);
router.get('/:id/quotes/compare', controller.compareQuotes);

module.exports = router;
