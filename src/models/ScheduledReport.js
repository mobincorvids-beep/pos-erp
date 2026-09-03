const { Schema, model } = require('mongoose');

// A saved "send me this report on a schedule" definition. Nothing here
// fires itself — see scheduledReportService.getDueScheduledReports for the
// query a cron/worker would poll, and renderAndQueueReport for the part
// that actually builds + emails one. Wiring an actual scheduler trigger
// (node-cron, a queue, etc.) that calls those on an interval is a
// follow-up; this is the queryable/persistence layer underneath it.
const scheduledReportSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  // Matches the report keys reportingService exposes (e.g. 'sales-summary',
  // 'trial-balance', 'abc-analysis', 'kpi-scorecard', 'comparative-period').
  reportType: { type: String, required: true },
  // Free-form params passed straight through to the underlying report
  // function (from/to/warehouseId/etc.) — shape depends on reportType.
  params: { type: Schema.Types.Mixed, default: {} },
  frequency: { type: String, required: true, enum: ['daily', 'weekly', 'monthly'] },
  recipientEmails: { type: [String], default: [] },
  format: { type: String, default: 'excel', enum: ['excel', 'csv', 'pdf'] },
  isActive: { type: Boolean, default: true },
  lastSentAt: { type: Date, default: null },
  nextSendAt: { type: Date, required: true },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

scheduledReportSchema.index({ companyId: 1, nextSendAt: 1 });

module.exports = model('ScheduledReport', scheduledReportSchema);
