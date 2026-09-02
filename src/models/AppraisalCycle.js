const { Schema, model } = require('mongoose');

// A recurring appraisal window (e.g. "Q1 2026 Appraisal") that a manager
// starts once and that fans out into one draft PerformanceReview per
// active employee — see performanceService.startAppraisalCycle(). Kept
// deliberately small: PerformanceReview already carries status/rating/etc
// per employee; this just groups them and gives the cycle itself a
// status so it can be reported on as a whole.
const appraisalCycleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  name: { type: String, required: true }, // e.g. "Q1 2026 Appraisal"
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

module.exports = model('AppraisalCycle', appraisalCycleSchema);
