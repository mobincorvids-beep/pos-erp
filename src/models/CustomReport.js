const { Schema, model } = require('mongoose');

// A saved report DEFINITION — the actual data is never stored here, only
// the spec used to build a Mongo aggregation pipeline at run time (see
// customReportService.runReport). Deliberately restricted to a small,
// explicit allowlist of source collections/fields rather than accepting
// arbitrary user-supplied query objects — this is what keeps a "custom
// report builder" from becoming an arbitrary-query injection surface.
const reportFilterSchema = new Schema({
  field: { type: String, required: true },
  operator: { type: String, required: true, enum: ['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'between'] },
  value: { type: Schema.Types.Mixed, required: true },
}, { _id: false });

const reportMetricSchema = new Schema({
  field: { type: String, required: true }, // the numeric field to aggregate, e.g. "totalAmount"
  aggregation: { type: String, required: true, enum: ['sum', 'avg', 'count', 'min', 'max'] },
  label: { type: String, default: '' }, // display label, defaults to `${aggregation}(${field})` if blank
}, { _id: false });

const customReportSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },

  // The allowlist itself lives in customReportService.SOURCE_REGISTRY —
  // this just names which entry to use.
  sourceCollection: { type: String, required: true },

  filters: { type: [reportFilterSchema], default: [] },
  groupByField: { type: String, default: null }, // null = one aggregate row for the whole filtered set
  metrics: { type: [reportMetricSchema], default: [] },
  sortBy: { type: String, default: null }, // one of the metric labels, or the groupBy field
  sortDirection: { type: String, default: 'desc', enum: ['asc', 'desc'] },
  limit: { type: Number, default: 100 },

  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

customReportSchema.index({ companyId: 1, name: 1 }, { unique: true });

module.exports = model('CustomReport', customReportSchema);
