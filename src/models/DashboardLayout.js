const { Schema, model } = require('mongoose');

// Persists one user's chosen dashboard widget arrangement. Just the
// storage layer — the frontend owns the actual widget catalog/rendering.
// Plausible widgetType values (documentation only, not enforced as an
// enum since new widget types will be added on the frontend over time):
//   'kpi_scorecard', 'sales_trend', 'low_stock_list', 'top_products',
//   'ar_aging', 'project_profitability', 'recent_activity'
const widgetSchema = new Schema({
  widgetType: { type: String, required: true },
  position: { type: Number, default: 0 }, // sort order / grid slot index
  config: { type: Schema.Types.Mixed, default: {} }, // per-widget options, e.g. { limit: 5, dateRange: '30d' }
}, { _id: false });

const dashboardLayoutSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  widgets: { type: [widgetSchema], default: [] },
}, { timestamps: true });

// One layout per user per company.
dashboardLayoutSchema.index({ companyId: 1, userId: 1 }, { unique: true });

module.exports = model('DashboardLayout', dashboardLayoutSchema);
