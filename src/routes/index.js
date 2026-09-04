const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/auth', require('./oauthRoutes')); // Google/Microsoft SSO — see src/config/passport.js for env-var-gated setup
router.use('/products', require('./productRoutes'));
router.use('/products', require('./productChannelRoutes')); // adds /:id/channel — disjoint sub-path from productRoutes
router.use('/categories', require('./categoryRoutes'));
router.use('/sales', require('./saleRoutes'));
router.use('/cheques', require('./chequeRoutes')); // receivable (from customers) and payable (to suppliers) cheque tracking
router.use('/sales-workflow', require('./salesOrderRoutes')); // quotations & sales orders
router.use('/purchase-orders', require('./purchaseRoutes'));
router.use('/requisitions', require('./requisitionRoutes'));
router.use('/rfqs', require('./rfqRoutes'));
router.use('/cost-centers', require('./costCenterRoutes'));
router.use('/units', require('./unitRoutes'));
router.use('/accounting-periods', require('./periodRoutes'));
router.use('/employee-loans', require('./employeeLoanRoutes'));
router.use('/credit-notes', require('./creditNoteRoutes'));
router.use('/debit-notes', require('./debitNoteRoutes'));
router.use('/timesheets', require('./timesheetRoutes'));
router.use('/recurring-invoices', require('./recurringInvoiceRoutes'));
router.use('/budgets', require('./budgetRoutes'));
router.use('/purchase-orders/early-payment', require('./earlyPaymentDiscountRoutes'));
router.use('/stock-transfers', require('./transferRoutes'));
router.use('/stock-counts', require('./stockCountRoutes'));
router.use('/manufacturing', require('./manufacturingRoutes'));
router.use('/subcontracting', require('./subcontractRoutes'));
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
router.use('/price-lists', require('./priceListRoutes'));
router.use('/route-sales', require('./routeSalesRoutes'));
router.use('/secondary-sales', require('./secondarySaleRoutes'));
router.use('/suppliers', require('./supplierRoutes'));
router.use('/loyalty', require('./loyaltyRoutes'));
router.use('/coupons', require('./couponRoutes'));
router.use('/gift-cards', require('./giftCardRoutes'));
router.use('/appointments', require('./appointmentRoutes'));
router.use('/crm', require('./crmRoutes'));
router.use('/hr', require('./hrRoutes'));
router.use('/attendance', require('./attendanceRoutes')); // self-service clock-in/out — see that file's header comment
router.use('/fixed-assets', require('./fixedAssetRoutes'));
router.use('/dashboard', require('./dashboardRoutes'));
router.use('/currency', require('./currencyRoutes'));
router.use('/documents', require('./documentRoutes'));
router.use('/tickets', require('./ticketRoutes'));
router.use('/knowledge-base', require('./knowledgeBaseRoutes'));
router.use('/notifications', require('./notificationRoutes'));
router.use('/chat', require('./chatRoutes'));
router.use('/calendar', require('./calendarRoutes'));
router.use('/maintenance', require('./maintenanceRoutes'));
router.use('/portal', require('./portalRoutes'));
router.use('/portal-session', require('./portalSessionRoutes'));
router.use('/workflows', require('./workflowRoutes'));
router.use('/webhooks', require('./webhookRoutes'));
router.use('/payment-gateway', require('./paymentGatewayRoutes')); // JazzCash/Easypaisa — callback/:provider is public, see that file
router.use('/tax-payments', require('./taxPaymentRoutes')); // vendor pays own FBR tax liability via JazzCash — jazzcash-callback is public, see that file
router.use('/fbr-compliance', require('./fbrComplianceRoutes')); // FBR Digital Invoicing dashboard: counts, outstanding sales, retry-all
router.use('/projects', require('./projectRoutes'));
router.use('/tasks', require('./taskRoutes'));
router.use('/ecommerce-config', require('./ecommerceConfigRoutes')); // tenant-side setup
router.use('/ecommerce', require('./ecommerceWebhookRoutes'));        // external store calls this — webhook-token auth, not JWT
router.use('/ai', require('./aiInsightsRoutes'));
router.use('/account-settings', require('./accountSettingsRoutes'));
router.use('/fleet', require('./fleetRoutes'));
router.use('/fleet', require('./fleetAnalyticsRoutes')); // fuel efficiency, freight quoting — disjoint paths from fleetRoutes
router.use('/fleet/incidents', require('./vehicleIncidentRoutes'));
router.use('/fleet/drivers', require('./driverRoutes'));
router.use('/fleet/maintenance', require('./fleetMaintenanceRoutes'));
router.use('/bin-transfers', require('./binTransferRoutes'));
router.use('/license-plates', require('./licensePlateRoutes'));
router.use('/supplier-invoices', require('./supplierInvoiceRoutes'));
router.use('/demand-forecast', require('./demandForecastRoutes'));
router.use('/drp', require('./drpRoutes'));
router.use('/stock-allocation', require('./stockAllocationRoutes'));
router.use('/custom-reports', require('./customReportRoutes'));
router.use('/project-billing', require('./projectBillingRoutes'));
router.use('/pack-ship', require('./packShipRoutes'));
router.use('/warehouse/scan', require('./scanRoutes'));
router.use('/asns', require('./asnRoutes'));
router.use('/supplier-scorecards', require('./supplierScorecardRoutes'));
router.use('/supplier-onboarding', require('./supplierOnboardingRoutes'));
router.use('/inventory-valuation', require('./inventoryValuationRoutes'));
router.use('/inventory-aging', require('./inventoryAgingRoutes'));
router.use('/batches', require('./batchTraceabilityRoutes'));
router.use('/network-stock', require('./networkStockRoutes'));
router.use('/rma', require('./rmaRoutes'));
router.use('/carts', require('./cartRoutes'));
router.use('/change-orders', require('./changeOrderRoutes'));
router.use('/scheduled-reports', require('./scheduledReportRoutes'));
router.use('/dashboard-layout', require('./dashboardLayoutRoutes'));
router.use('/field-service', require('./fieldServiceRoutes'));
router.use('/quality', require('./qualityRoutes'));
router.use('/contracts', require('./contractRoutes'));
router.use('/supplier-portal', require('./supplierPortalRoutes'));
router.use('/supplier-portal-session', require('./supplierPortalSessionRoutes'));
router.use('/employee-portal', require('./employeePortalRoutes'));
router.use('/employee-portal-session', require('./employeePortalSessionRoutes'));
router.use('/logistics', require('./logisticsRoutes'));
router.use('/warehouse', require('./warehouseZoneRoutes'));
router.use('/warehouse', require('./reorderRuleRoutes'));
router.use('/pick-waves', require('./pickWaveRoutes'));
router.use('/recruitment', require('./recruitmentRoutes'));
router.use('/performance', require('./performanceRoutes'));
router.use('/funnels', require('./funnelRoutes'));
router.use('/public/funnels', require('./publicFunnelRoutes')); // public, no JWT — mirrors ecommerceWebhookRoutes.js
router.use('/marketing', require('./marketingRoutes')); // audience segments + drip/journey automation
router.use('/review-requests', require('./reviewRequestRoutes'));
router.use('/public/reviews', require('./publicReviewRoutes')); // public, no JWT — mirrors publicFunnelRoutes.js
router.use('/call-logs', require('./callLogRoutes'));
router.use('/whatsapp', require('./whatsappRoutes')); // per-tenant WhatsApp Business API — credentials via /org/company, send log here
router.use('/developer/api-keys', require('./apiKeyRoutes'));
router.use('/developer/webhooks', require('./webhookSubscriptionRoutes'));
router.use('/public-api/v1', require('./publicApiRoutes')); // public, apiKeyAuth only — no JWT
router.use('/sales-channels', require('./salesChannelRoutes')); // includes public /webhook/:token receiver
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
