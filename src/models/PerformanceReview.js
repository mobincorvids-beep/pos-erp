const { Schema, model } = require('mongoose');

// Period modeled as plain text (e.g. "2026-Q1", "2026-H1"), matching how
// PayrollRun keeps month/year as simple scalars rather than a shared
// Period model — there is no dedicated Period model in this codebase to
// reuse, so a free-text label keeps this consistent with that convention
// and avoids inventing a new cross-cutting model for one field.
const goalSnapshotSchema = new Schema({
  goalId: { type: Schema.Types.ObjectId, ref: 'Goal', required: true },
  achievementNote: String,
}, { _id: false });

const performanceReviewSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  reviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },

  period: { type: String, required: true }, // e.g. "2026-Q1"

  overallRating: { type: Number, min: 1, max: 5 },
  strengths: String,
  areasForImprovement: String,

  goals: [goalSnapshotSchema], // goals referenced/discussed in this review

  status: { type: String, enum: ['draft', 'submitted', 'acknowledged'], default: 'draft' },
  submittedAt: Date,
  acknowledgedAt: Date,
}, { timestamps: true });

module.exports = model('PerformanceReview', performanceReviewSchema);
