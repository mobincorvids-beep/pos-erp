const { Schema, model } = require('mongoose');

// One row per (journey, customer) — tracks where that customer is in the
// journey's step sequence and when their next step should fire. This is
// the queue marketingJourneyService.processDueSteps() polls
// (status: 'active', nextStepAt <= now).
const journeyEnrollmentSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  journeyId: { type: Schema.Types.ObjectId, ref: 'MarketingJourney', required: true, index: true },
  customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
  currentStepIndex: { type: Number, default: 0 },
  // When the step at currentStepIndex should be executed. Null once the
  // enrollment is completed/cancelled — nothing left to fire.
  nextStepAt: { type: Date, default: null, index: true },
  status: { type: String, default: 'active', enum: ['active', 'completed', 'cancelled'] },
  enrolledAt: { type: Date, default: Date.now },
  completedAt: { type: Date, default: null },
  // Audit trail of what actually happened at each step (send result,
  // provider used, or a wait having elapsed) — lets "enrollment stats"
  // show real per-step history, not just the current pointer.
  history: [{
    stepIndex: Number,
    stepType: String,
    firedAt: { type: Date, default: Date.now },
    success: Boolean,
    provider: String,
    error: String,
  }],
}, { timestamps: true });

// A customer can only be actively enrolled in a given journey once at a
// time — re-entering after completion/cancellation is allowed (partial
// unique index scoped to status: 'active').
journeyEnrollmentSchema.index(
  { journeyId: 1, customerId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);
// Backs processDueSteps()'s due-step scan.
journeyEnrollmentSchema.index({ status: 1, nextStepAt: 1 });

module.exports = model('JourneyEnrollment', journeyEnrollmentSchema);
