const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_VIEW, REPORTS_FINANCIAL } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/reportController');
const consolidatedController = require('../controllers/consolidatedReportController');
const badDebtController = require('../controllers/badDebtController');

router.use(requireAuth, scopeToCompany);
router.get('/stock-valuation', requirePermission(REPORTS_VIEW), controller.stockValuation);
router.get('/sales-summary', requirePermission(REPORTS_VIEW), controller.salesSummary);
router.get('/low-stock', requirePermission(REPORTS_VIEW), controller.lowStock);
router.get('/top-products', requirePermission(REPORTS_VIEW), controller.topProducts);           // ?from=&to=&limit=
router.get('/top-customers', requirePermission(REPORTS_VIEW), controller.topCustomers);         // ?from=&to=&limit=
router.get('/salesperson-performance', requirePermission(REPORTS_VIEW), controller.salespersonPerformance); // ?from=&to=
router.get('/branch-comparison', requirePermission(REPORTS_VIEW), controller.branchComparison); // ?from=&to=
router.get('/stock-movement', requirePermission(REPORTS_VIEW), controller.stockMovement);       // ?warehouseId=&from=&to=
router.get('/abc-analysis', requirePermission(REPORTS_VIEW), controller.abcAnalysis);            // ?from=&to= — Pareto ABC SKU classification by sales value

// Drill-down from a summary row to its underlying transactions.
router.get('/sales-summary/drill-down', requirePermission(REPORTS_VIEW), controller.salesSummaryDrillDown); // ?from=&to=&groupBy=day|paymentMethod&groupKey=
// Comparative period analysis (MoM/YoY) and cross-module KPI scorecard.
router.get('/comparative-period', requirePermission(REPORTS_VIEW), controller.comparativePeriod); // ?metric=revenue|grossMargin&periodType=month|year&periodsBack=
router.get('/kpi-scorecard', requirePermission(REPORTS_VIEW), controller.kpiScorecard); // ?from=&to=

// Financial statements are gated behind a stricter permission — a cashier
// who can view sales-summary shouldn't necessarily see the company's P&L.
router.get('/trial-balance', requirePermission(REPORTS_FINANCIAL), controller.trialBalance);
router.get('/profit-and-loss', requirePermission(REPORTS_FINANCIAL), controller.profitAndLoss);
router.get('/balance-sheet', requirePermission(REPORTS_FINANCIAL), controller.balanceSheet);
router.get('/cash-bank-book', requirePermission(REPORTS_FINANCIAL), controller.cashBankBook);
router.get('/expense-report', requirePermission(REPORTS_FINANCIAL), controller.expenseReport); // ?from=&to= — expense detail is financial, not just operational
router.get('/trial-balance/drill-down', requirePermission(REPORTS_FINANCIAL), controller.trialBalanceDrillDown); // ?asOfDate=&groupKey=<accountId>

// Multi-company: group is derived from the requester's own companyId — see
// consolidatedReportService for why a tenant can never request an arbitrary
// company's data this way.
router.get('/consolidated/group', requirePermission(REPORTS_VIEW), consolidatedController.group);
router.get('/consolidated/sales-summary', requirePermission(REPORTS_VIEW), consolidatedController.salesSummary); // ?from=&to=
router.get('/consolidated/trial-balance', requirePermission(REPORTS_FINANCIAL), consolidatedController.trialBalance); // ?asOfDate=

router.get('/ar-aging', requirePermission(REPORTS_FINANCIAL), badDebtController.arAgingReport); // ?asOfDate=
router.get('/ap-aging', requirePermission(REPORTS_FINANCIAL), controller.apAging); // ?asOfDate=
router.post('/write-off/:saleId', requirePermission(REPORTS_FINANCIAL),
  body('badDebtExpenseAccountId').isString().notEmpty().withMessage('badDebtExpenseAccountId is required.'),
  body('receivableAccountId').isString().notEmpty().withMessage('receivableAccountId is required.'),
  validate, badDebtController.writeOffReceivable);

module.exports = router;
