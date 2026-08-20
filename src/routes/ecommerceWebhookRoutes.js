const router = require('express').Router();
const { requireWebhookToken } = require('../middleware/ecommerceAuth');
const controller = require('../controllers/ecommerceWebhookController');

// No requireAuth/scopeToCompany here on purpose — an external store has no
// tenant user session. requireWebhookToken is the entire auth story for
// this router, resolving req.company/req.companyId from the slug + token.
router.use('/:slug', requireWebhookToken);
router.get('/:slug/products', controller.productFeed);
router.post('/:slug/orders', controller.importOrder);

module.exports = router;
