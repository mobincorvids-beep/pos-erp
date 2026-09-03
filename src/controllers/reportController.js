const reportingService = require('../services/reportingService');
const reportExportService = require('../services/reportExportService');

/**
 * Shared ?format=excel|pdf|csv handling for any report — same
 * already-computed {columns, rows} handed to whichever exporter the
 * caller asked for, so a report gains all three export formats by calling
 * this once rather than hand-rolling the format switch itself. Returns
 * true if it sent a file response (caller should not also send JSON).
 */
async function sendExport(res, format, { title, filename, columns, rows, generatedAt }) {
  if (format === 'excel') {
    const buffer = await reportExportService.toExcelBuffer({ title, columns, rows });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    res.send(buffer);
    return true;
  }
  if (format === 'csv') {
    const buffer = reportExportService.toCsvBuffer({ columns, rows });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.send(buffer);
    return true;
  }
  if (format === 'pdf') {
    const buffer = await reportExportService.toPdfBuffer({ title, columns, rows, generatedAt });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
    res.send(buffer);
    return true;
  }
  return false;
}

/** ?format=excel|pdf|csv on top of the exact same reportingService.trialBalance() every other caller already uses, the report logic itself is never duplicated, only its output is optionally rendered as a real downloadable file instead of JSON. */
async function trialBalance(req, res) {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    const report = await reportingService.trialBalance(req.companyId, asOfDate);

    const columns = [{ key: 'name', header: 'Account' }, { key: 'type', header: 'Type' }, { key: 'debit', header: 'Debit' }, { key: 'credit', header: 'Credit' }];
    const rows = [...report.accounts, { name: 'TOTAL', type: '', debit: report.totalDebit, credit: report.totalCredit }];
    if (await sendExport(res, req.query.format, { title: 'Trial Balance', filename: 'trial-balance', columns, rows, generatedAt: asOfDate })) return;

    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** ?format=excel|pdf|csv — inventory valuation, one row per warehouse/product/variant stock level (see reportingService.stockValuation). */
async function stockValuation(req, res) {
  try {
    const report = await reportingService.stockValuation(req.companyId, req.query.warehouseId || null);

    const columns = [
      { key: 'productName', header: 'Product' }, { key: 'quantity', header: 'Quantity' },
      { key: 'reservedQuantity', header: 'Reserved' }, { key: 'unitCost', header: 'Unit Cost' }, { key: 'value', header: 'Value' },
    ];
    const rows = [...report.rows, { productName: 'TOTAL', quantity: '', reservedQuantity: '', unitCost: '', value: report.totalValue }];
    if (await sendExport(res, req.query.format, { title: 'Inventory Valuation', filename: 'inventory-valuation', columns, rows })) return;

    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** ?format=excel|pdf|csv — exports the day-by-day breakdown (see reportingService.salesSummary's byDay), the most useful row shape for a spreadsheet/file; the JSON response still carries the full summary + payment-method breakdown too. */
async function salesSummary(req, res) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: '`from` and `to` query params are required (ISO dates).' });
    const report = await reportingService.salesSummary(req.companyId, from, to);

    const columns = [{ key: 'date', header: 'Date' }, { key: 'netSales', header: 'Net Sales' }, { key: 'invoiceCount', header: 'Invoices' }];
    const rows = [...report.byDay, { date: 'TOTAL', netSales: report.summary.netSales, invoiceCount: report.summary.invoiceCount }];
    if (await sendExport(res, req.query.format, { title: 'Sales Summary', filename: 'sales-summary', columns, rows })) return;

    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function profitAndLoss(req, res) {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: '`from` and `to` query params are required (ISO dates).' });
    const report = await reportingService.profitAndLoss(req.companyId, from, to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function balanceSheet(req, res) {
  try {
    const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
    const report = await reportingService.balanceSheet(req.companyId, asOfDate);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cashBankBook(req, res) {
  try {
    const { accountId, from, to } = req.query;
    if (!accountId || !from || !to) {
      return res.status(400).json({ error: '`accountId`, `from`, and `to` query params are required.' });
    }
    const report = await reportingService.cashBankBook(req.companyId, accountId, from, to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function lowStock(req, res) {
  try {
    const report = await reportingService.lowStockReport(req.companyId, req.query.warehouseId || null);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function apAging(req, res) {
  const asOfDate = req.query.asOfDate ? new Date(req.query.asOfDate) : new Date();
  res.json(await reportingService.apAgingReport(req.companyId, asOfDate));
}

function requireRange(req, res) {
  const { from, to } = req.query;
  if (!from || !to) {
    res.status(400).json({ error: '`from` and `to` query params are required (ISO dates).' });
    return null;
  }
  return { from, to };
}

async function topProducts(req, res) {
  try {
    const range = requireRange(req, res);
    if (!range) return;
    const report = await reportingService.topProductsReport(req.companyId, range.from, range.to, Number(req.query.limit) || 20);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function topCustomers(req, res) {
  try {
    const range = requireRange(req, res);
    if (!range) return;
    const report = await reportingService.topCustomersReport(req.companyId, range.from, range.to, Number(req.query.limit) || 20);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function salespersonPerformance(req, res) {
  try {
    const range = requireRange(req, res);
    if (!range) return;
    const report = await reportingService.salespersonPerformanceReport(req.companyId, range.from, range.to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function expenseReport(req, res) {
  try {
    const range = requireRange(req, res);
    if (!range) return;
    const report = await reportingService.expenseReport(req.companyId, range.from, range.to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function branchComparison(req, res) {
  try {
    const range = requireRange(req, res);
    if (!range) return;
    const report = await reportingService.branchComparisonReport(req.companyId, range.from, range.to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function stockMovement(req, res) {
  try {
    const range = requireRange(req, res);
    if (!range) return;
    const report = await reportingService.stockMovementReport(req.companyId, req.query.warehouseId || null, range.from, range.to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function abcAnalysis(req, res) {
  try {
    const range = requireRange(req, res);
    if (!range) return;
    const report = await reportingService.abcAnalysisReport(req.companyId, range.from, range.to);
    res.json(report);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  trialBalance, stockValuation, salesSummary, profitAndLoss, balanceSheet, cashBankBook,
  lowStock, topProducts, topCustomers, salespersonPerformance, expenseReport, branchComparison, stockMovement, apAging,
  abcAnalysis,
};
