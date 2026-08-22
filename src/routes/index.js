const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/products', require('./productRoutes'));
router.use('/sales', require('./saleRoutes'));
router.use('/sales-workflow', require('./salesOrderRoutes')); // quotations & sales orders
router.use('/purchase-orders', require('./purchaseRoutes'));
router.use('/requisitions', require('./requisitionRoutes'));
router.use('/rfqs', require('./rfqRoutes'));
router.use('/cost-centers', require('./costCenterRoutes'));
router.use('/units', require('./unitRoutes'));
router.use('/accounting-periods', require('./periodRoutes'));
router.use('/employee-loans', require('./employeeLoanRoutes'));
router.use('/recurring-invoices', require('./recurringInvoiceRoutes'));
router.use('/budgets', require('./budgetRoutes'));
router.use('/purchase-orders/early-payment', require('./earlyPaymentDiscountRoutes'));
router.use('/stock-transfers', require('./transferRoutes'));
router.use('/stock-counts', require('./stockCountRoutes'));
router.use('/manufacturing', require('./manufacturingRoutes'));
router.use('/service-orders', require('./serviceOrderRoutes'));
router.use('/banking', require('./bankingRoutes'));
router.use('/reports', require('./reportRoutes'));
router.use('/departments', require('./departmentRoutes'));
router.use('/audit-logs', require('./auditLogRoutes'));
router.use('/org', require('./orgRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/roles', require('./roleRoutes'));
router.use('/expense-categories', require('./expenseCategoryRoutes'));
router.use('/expenses', require('./expenseRoutes'));
router.use('/customers', require('./customerRoutes'));
router.use('/suppliers', require('./supplierRoutes'));
router.use('/loyalty', require('./loyaltyRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/crm', require('./crmRoutes'));
router.use('/hr', require('./hrRoutes'));
router.use('/fixed-assets', require('./fixedAssetRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/currency', require('./currencyRoutes'));
router.use('/documents', require('./documentRoutes'));
router.use('/tickets', require('./ticketRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/workflows', require('./workflowRoutes'));
router.use('/webhooks', require('./webhookRoutes'));
router.use('/payment-gateway', require('./paymentGatewayRoutes')); // JazzCash/Easypaisa — callback/:provider is public, see that file
router.use('/projects', require('./projectRoutes'));
router.use('/ecommerce-config', require('./ecommerceConfigRoutes')); // tenant-side setup
router.use('/ecommerce', require('./ecommerceWebhookRoutes'));        // external store calls this — webhook-token auth, not JWT
router.use('/ai', require('./aiInsightsRoutes'));
router.use('/account-settings', require('./accountSettingsRoutes'));
router.use('/admin', require('./admin')); // platform-admin layer — separate JWT namespace, see middleware/platformAuth.js

// Industry modules auto-mount themselves here — every folder under
// src/modules/ with a manifest.js gets its routes/index.js mounted at its
// declared mountPath automatically. Adding a NEW industry module now means
// creating the folder (manifest.js + routes/index.js, following any
// existing module as a template) — nothing in this file, or anywhere else
// in core, needs to be touched. This replaced 29 hand-written
// `router.use(...)` lines that had to be kept in sync by hand every time a
// module was added — exactly the kind of scattered wiring that's easy to
// forget one line of and hard to notice went stale.
const { mountIndustryModules } = require('./mountIndustryModules');
mountIndustryModules(router);

module.exports = router;
