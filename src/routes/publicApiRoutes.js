const router = require('express').Router();
const { apiKeyAuth } = require('../middleware/apiKeyAuth');
const { requireScope } = require('../services/apiKeyService');
const productController = require('../controllers/productController');
const saleController = require('../controllers/saleController');

// No requireAuth/scopeToCompany here on purpose — an external integration
// has no staff user session, exactly like ecommerceWebhookRoutes.js.
// apiKeyAuth is the entire auth story for this router: it resolves
// req.companyId from the presented API key and attaches req.apiKeyScopes,
// which requireScope() below then checks per-route. This file is mounted
// in src/routes/index.js at /public-api/v1 alongside (not behind) the
// normal staff routers — see the final report for exactly why that mount
// bypasses the app's JWT auth (JWT is applied per-router via requireAuth,
// not globally in app.js, so simply never calling requireAuth here is
// sufficient).
router.use(apiKeyAuth);

// Read-only example surface proving apiKeyAuth end-to-end. Delegates to
// the existing staff controllers' list() handlers rather than duplicating
// query/filter logic — those already read companyId off req.companyId and
// req.query, which apiKeyAuth populates identically to requireAuth +
// scopeToCompany, so no branching was needed in productController/
// saleController at all.
router.get('/products', requireScope('products:read'), productController.list);
router.get('/sales', requireScope('sales:read'), saleController.list);

module.exports = router;
