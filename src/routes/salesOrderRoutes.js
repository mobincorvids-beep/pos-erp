const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/salesOrderController');

// PUBLIC — registered BEFORE the requireAuth/scopeToCompany middleware
// below, so this one route never gets it (Express applies router.use()
// middleware only to routes registered after it in the same router). No
// JWT, no staff session — same "no requireAuth at all" pattern as
// publicFunnelRoutes.js/publicReviewRoutes.js; here the order number +
// customer phone the caller supplies IS the auth. This file stays mounted
// at /sales-workflow (src/routes/index.js, unmodified), so the full path
// is GET /sales-workflow/track?orderNumber=...&phone=...
router.get('/track', controller.publicTrackOrder);

router.use(requireAuth, scopeToCompany);

router.get('/quotations', controller.listQuotations);
router.post('/quotations', controller.createQuotation);
router.post('/quotations/:id/accept', controller.acceptQuotation); // -> becomes a sales order

router.get('/sales-orders', controller.listSalesOrders);
router.post('/sales-orders', controller.createSalesOrder);

// Works on either a quotation or a sales order document.
router.post('/:id/convert-to-invoice', controller.convertToInvoice);
router.post('/:id/cancel', controller.cancel);

module.exports = router;
