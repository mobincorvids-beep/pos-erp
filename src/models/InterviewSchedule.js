const { Schema, model } = require('mongoose');

// One scheduled (and later completed) interview session for a Candidate.
// A candidate can have several across the pipeline (screening call, then
// a panel interview, etc.) so this is its own collection rather than an
// embedded array — each interview gets its own interviewer/feedback/rating.
const interviewScheduleSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  candidateId: { type: Schema.Types.ObjectId, ref: 'Candidate', required: true, index: true },
  scheduledAt: { type: Date, required: true },
  interviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  mode: { type: String, default: 'in_person', enum: ['in_person', 'phone', 'video'] },
  feedback: { type: String, default: '' },
  rating: { type: Number, min: 1, max: 5, default: null },
  completedAt: { type: Date, default: null },
}, { timestamps: true });

interviewScheduleSchema.index({ companyId: 1, candidateId: 1 });

module.exports = model('InterviewSchedule', interviewScheduleSchema);
