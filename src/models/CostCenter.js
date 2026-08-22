const { Schema, model } = require('mongoose');

// A cost/profit center — a department, a project, a unit — that real
// voucher entries can optionally be tagged against. Genuinely different
// from Branch P&L (which core already has) and Project P&L (which
// projectService already has): those are keyed to a physical location or
// a specific customer-facing project respectively, while a cost center is
// an arbitrary internal grouping that can cut across both.
const costCenterSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true },
  code: String,
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = model('CostCenter', costCenterSchema);
