const router = require('express').Router();
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_VIEW, REPORTS_FINANCIAL } = require('../constants/permissions');
const controller = require('../controllers/reportController');
const consolidatedController = require('../controllers/consolidatedReportController');

router.use(requireAuth, scopeToCompany);
router.get('/stock-valuation', requirePermission(REPORTS_VIEW), controller.stockValuation);
router.get('/sales-summary', requirePermission(REPORTS_VIEW), controller.salesSummary);
router.get('/low-stock', requirePermission(REPORTS_VIEW), controller.lowStock);
router.get('/top-products', requirePermission(REPORTS_VIEW), controller.topProducts);           // ?from=&to=&limit=
router.get('/top-customers', requirePermission(REPORTS_VIEW), controller.topCustomers);         // ?from=&to=&limit=
router.get('/salesperson-performance', requirePermission(REPORTS_VIEW), controller.salespersonPerformance); // ?from=&to=
router.get('/branch-comparison', requirePermission(REPORTS_VIEW), controller.branchComparison); // ?from=&to=
router.get('/stock-movement', requirePermission(REPORTS_VIEW), controller.stockMovement);       // ?warehouseId=&from=&to=

// Financial statements are gated behind a stricter permission — a cashier
// who can view sales-summary shouldn't necessarily see the company's P&L.
router.get('/trial-balance', requirePermission(REPORTS_FINANCIAL), controller.trialBalance);
router.get('/profit-and-loss', requirePermission(REPORTS_FINANCIAL), controller.profitAndLoss);
router.get('/balance-sheet', requirePermission(REPORTS_FINANCIAL), controller.balanceSheet);
router.get('/cash-bank-book', requirePermission(REPORTS_FINANCIAL), controller.cashBankBook);
router.get('/expense-report', requirePermission(REPORTS_FINANCIAL), controller.expenseReport); // ?from=&to= — expense detail is financial, not just operational

// Multi-company: group is derived from the requester's own companyId — see
// consolidatedReportService for why a tenant can never request an arbitrary
// company's data this way.
router.get('/consolidated/group', requirePermission(REPORTS_VIEW), consolidatedController.group);
router.get('/consolidated/sales-summary', requirePermission(REPORTS_VIEW), consolidatedController.salesSummary); // ?from=&to=
router.get('/consolidated/trial-balance', requirePermission(REPORTS_FINANCIAL), consolidatedController.trialBalance); // ?asOfDate=

module.exports = router;
