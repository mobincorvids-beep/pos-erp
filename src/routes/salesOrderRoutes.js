const router = require('express').Router();
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const controller = require('../controllers/salesOrderController');

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
