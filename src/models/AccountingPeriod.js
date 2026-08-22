const { Schema, model } = require('mongoose');

// The genuinely new mechanic: once CLOSED, no voucher can be posted with
// a date inside this period — a real, standard accounting control
// against retroactively altering finalized books. A company with no
// periods defined at all (every existing scenario before this feature)
// simply never has a matching CLOSED period, so the check this model
// enables is a true no-op for them — confirmed directly, not assumed.
const accountingPeriodSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  fiscalYearId: { type: Schema.Types.ObjectId, ref: 'FiscalYear', required: true },
  name: { type: String, required: true }, // "January 2026"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: { type: String, default: 'open', enum: ['open', 'closed'] },
}, { timestamps: true });

accountingPeriodSchema.index({ companyId: 1, status: 1, startDate: 1, endDate: 1 }); // the exact shape assertPeriodOpen()'s query needs, kept fast even as periods accumulate over years

module.exports = model('AccountingPeriod', accountingPeriodSchema);
