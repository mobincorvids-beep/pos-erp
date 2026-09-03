const { Schema, model } = require('mongoose');

const projectSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', default: null },
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  budget: { type: Number, default: 0 },
  // Budget granularity by category, e.g. { labor: 20000, material: 15000,
  // subcontractor: 8000, overhead: 2000 }. Optional — a project with no
  // per-category split still works fine against the single `budget` total;
  // this only enables the finer actual-vs-budget breakdown in
  // projectService.profitabilityByCategory. Keys are free-form so they
  // line up with whatever categories a company uses, but by convention
  // should match ProjectCost.type values ('labor', 'material',
  // 'subcontractor', 'expense', 'purchase', 'manual') so actuals bucket
  // against them without an extra mapping step.
  budgetByCategory: { type: Map, of: Number, default: {} },
  status: { type: String, default: 'planned', enum: ['planned', 'in_progress', 'completed', 'cancelled'] },
  managerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  startDate: Date,
  endDate: Date,
}, { timestamps: true });

module.exports = model('Project', projectSchema);
