const { Schema, model } = require('mongoose');

// One applicant against one JobOpening, tracked through the hiring
// pipeline. No binary file upload/storage exists in this app yet (see
// Contract.attachmentNote for the same honest gap) — resumeNote is a
// plain text pointer ("see resume in shared drive, filename X"), not a
// fabricated upload feature.
const candidateSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  jobOpeningId: { type: Schema.Types.ObjectId, ref: 'JobOpening', required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, default: '' },
  phone: { type: String, default: '' },
  resumeNote: { type: String, default: '' }, // e.g. "see Recruitment drive, JaneDoe-CV.pdf" — plain text, no upload infra exists yet
  source: {
    type: String, default: 'direct',
    enum: ['referral', 'job_board', 'direct', 'agency', 'other'],
  },
  stage: {
    type: String, default: 'applied',
    enum: ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'],
  },
  rejectionReason: { type: String, default: null },
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null }, // set once hireCandidate() converts this candidate into a real Employee
}, { timestamps: true });

candidateSchema.index({ companyId: 1, stage: 1 });

module.exports = model('Candidate', candidateSchema);
