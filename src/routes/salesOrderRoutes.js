const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { ORDER_HOLDS_MANAGE } = require('../constants/permissions');
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

// Multi-channel consolidated order view — POS, sales orders/quotations,
// e-commerce in one unified shape. ?channel=&status=&from=&to=
router.get('/consolidated', controller.getConsolidatedOrders);

// Order holds — credit_hold is placed automatically by createSalesOrder;
// fraud_review/manual_hold are placed here directly. Releasing either kind
// goes through the same endpoint.
router.post('/:id/hold', requirePermission(ORDER_HOLDS_MANAGE), controller.placeOrderHold);
router.post('/:id/release-hold', requirePermission(ORDER_HOLDS_MANAGE), controller.releaseOrderHold);

// Order splitting/merging.
router.post('/:id/split', controller.splitOrder);
router.post('/merge', controller.mergeOrders);

// Partial fulfillment / backorder: invoices whatever's available now and
// splits the shortfall into a new linked backorder sales_order. Body:
// { warehouseId?, itemFulfillments?: [{variantId,batchId,quantity}], invoiceInput?: {...} }
router.post('/:id/fulfill-partially', controller.fulfillPartially);

module.exports = router;
