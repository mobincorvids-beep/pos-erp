const { Schema, model } = require('mongoose');

const fiscalYearSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // "FY2026"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, default: 'open', enum: ['open', 'closed'] },
}, { timestamps: true });

module.exports = model('FiscalYear', fiscalYearSchema);
