/**
 * ScheduledReportService — CRUD for "send me this report on a schedule"
 * definitions, plus the two pieces an actual scheduler would call:
 *   getDueScheduledReports  — what's due to run right now
 *   renderAndQueueReport    — render one and hand it to the existing email sender
 * Nothing here fires itself on an interval — there's no cron/worker
 * process in this codebase to hook into safely, so wiring an actual
 * trigger (node-cron, a queue consumer, etc.) that calls
 * getDueScheduledReports() on a timer and then renderAndQueueReport() for
 * each one is a follow-up. This module is deliberately just the
 * queryable "what's due" + "render it" pieces underneath that.
 */
const ScheduledReport = require('../models/ScheduledReport');
const reportingService = require('./reportingService');
const reportExportService = require('./reportExportService');
const { sendEmail } = require('./messaging/messagingService');

const VALID_FREQUENCIES = ['daily', 'weekly', 'monthly'];

function computeNextSendAt(frequency, from = new Date()) {
  const next = new Date(from);
  if (frequency === 'daily') next.setUTCDate(next.getUTCDate() + 1);
  else if (frequency === 'weekly') next.setUTCDate(next.getUTCDate() + 7);
  else if (frequency === 'monthly') next.setUTCMonth(next.getUTCMonth() + 1);
  else throw new Error(`Invalid frequency "${frequency}".`);
  return next;
}

async function createScheduledReport(input) {
  const { companyId, reportType, params, frequency, recipientEmails, format, createdBy } = input;
  if (!reportType) throw new Error('reportType is required.');
  if (!VALID_FREQUENCIES.includes(frequency)) throw new Error(`frequency must be one of ${VALID_FREQUENCIES.join(', ')}.`);
  if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) throw new Error('recipientEmails must be a non-empty array.');

  return ScheduledReport.create({
    companyId, reportType, params: params || {}, frequency, recipientEmails,
    format: format || 'excel', createdBy: createdBy || null,
    nextSendAt: computeNextSendAt(frequency),
  });
}

function listScheduledReports(companyId) {
  return ScheduledReport.find({ companyId }).sort({ createdAt: -1 });
}

async function getScheduledReport(companyId, id) {
  const sr = await ScheduledReport.findOne({ _id: id, companyId });
  if (!sr) throw new Error('Scheduled report not found.');
  return sr;
}

async function updateScheduledReport(companyId, id, patch) {
  const sr = await getScheduledReport(companyId, id);
  const { reportType, params, frequency, recipientEmails, format, isActive } = patch;
  if (reportType !== undefined) sr.reportType = reportType;
  if (params !== undefined) sr.params = params;
  if (frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(frequency)) throw new Error(`frequency must be one of ${VALID_FREQUENCIES.join(', ')}.`);
    sr.frequency = frequency;
    sr.nextSendAt = computeNextSendAt(frequency);
  }
  if (recipientEmails !== undefined) sr.recipientEmails = recipientEmails;
  if (format !== undefined) sr.format = format;
  if (isActive !== undefined) sr.isActive = isActive;
  await sr.save();
  return sr;
}

async function deleteScheduledReport(companyId, id) {
  const sr = await getScheduledReport(companyId, id);
  await sr.deleteOne();
  return { deleted: true };
}

/** What's due to run right now for a company — the query an actual scheduler would poll. */
function getDueScheduledReports(companyId, asOf = new Date()) {
  return ScheduledReport.find({ companyId, isActive: true, nextSendAt: { $lte: asOf } });
}

// reportType -> reportingService function + how to build its {columns, rows} export shape.
// Kept small and explicit (rather than generic reflection) so each entry
// can shape columns sensibly for that report.
const REPORT_RENDERERS = {
  'sales-summary': {
    run: (companyId, params) => reportingService.salesSummary(companyId, params.from, params.to),
    toExport: (report) => ({
      title: 'Sales Summary',
      columns: [{ key: 'date', header: 'Date' }, { key: 'netSales', header: 'Net Sales' }, { key: 'invoiceCount', header: 'Invoices' }],
      rows: [...report.byDay, { date: 'TOTAL', netSales: report.summary.netSales, invoiceCount: report.summary.invoiceCount }],
    }),
  },
  'trial-balance': {
    run: (companyId, params) => reportingService.trialBalance(companyId, params.asOfDate ? new Date(params.asOfDate) : new Date()),
    toExport: (report) => ({
      title: 'Trial Balance',
      columns: [{ key: 'name', header: 'Account' }, { key: 'type', header: 'Type' }, { key: 'debit', header: 'Debit' }, { key: 'credit', header: 'Credit' }],
      rows: [...report.accounts, { name: 'TOTAL', type: '', debit: report.totalDebit, credit: report.totalCredit }],
    }),
  },
  'abc-analysis': {
    run: (companyId, params) => reportingService.abcAnalysisReport(companyId, params.from, params.to),
    toExport: (report) => ({
      title: 'ABC Analysis',
      columns: [{ key: 'productName', header: 'Product' }, { key: 'salesValue', header: 'Sales Value' }, { key: 'class', header: 'Class' }],
      rows: report.rows,
    }),
  },
};

/**
 * Renders one scheduled report using its saved reportType/params, exports
 * it via reportExportService (same excel/csv/pdf functions the on-demand
 * report endpoints use), and hands it off to messagingService.sendEmail —
 * the same email transport every other module (marketing, CRM, review
 * requests) already goes through, no new email dependency added.
 * messagingService.sendEmail's contract is "attach a message body", not a
 * binary attachment, so this sends a short summary + a note of the export
 * size/format; wiring an actual file attachment depends on whichever real
 * transport (SendGrid) is configured and is a reasonable next step, not
 * duplicated here.
 */
async function renderAndQueueReport(scheduledReportId) {
  const sr = await ScheduledReport.findById(scheduledReportId);
  if (!sr) throw new Error('Scheduled report not found.');

  const renderer = REPORT_RENDERERS[sr.reportType];
  if (!renderer) throw new Error(`No renderer registered for reportType "${sr.reportType}". Known types: ${Object.keys(REPORT_RENDERERS).join(', ')}.`);

  const report = await renderer.run(sr.companyId, sr.params || {});
  const { title, columns, rows } = renderer.toExport(report);

  let buffer;
  if (sr.format === 'csv') buffer = reportExportService.toCsvBuffer({ columns, rows });
  else if (sr.format === 'pdf') buffer = await reportExportService.toPdfBuffer({ title, columns, rows, generatedAt: new Date() });
  else buffer = await reportExportService.toExcelBuffer({ title, columns, rows });

  const results = await Promise.all(sr.recipientEmails.map((to) => sendEmail(
    to,
    `Scheduled report: ${title}`,
    `Your scheduled "${title}" report (${sr.frequency}) is ready — ${rows.length} rows, ${sr.format} format, ${buffer.length} bytes.`,
  )));

  sr.lastSentAt = new Date();
  sr.nextSendAt = computeNextSendAt(sr.frequency, sr.lastSentAt);
  await sr.save();

  return { scheduledReportId: sr._id, reportType: sr.reportType, format: sr.format, rowCount: rows.length, emailResults: results };
}

module.exports = {
  createScheduledReport, listScheduledReports, getScheduledReport, updateScheduledReport, deleteScheduledReport,
  getDueScheduledReports, renderAndQueueReport,
};
