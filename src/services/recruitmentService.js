/**
 * RecruitmentService — job openings, candidates, interview scheduling,
 * and the hiring pipeline. Deliberately does NOT duplicate any
 * Employee-creation logic: hireCandidate() calls straight into
 * hrService.createEmployee(input), the exact same function hrController
 * uses for the "Add employee" flow, so a hired candidate becomes a real
 * Employee through the one canonical path.
 */
const JobOpening = require('../models/JobOpening');
const Candidate = require('../models/Candidate');
const InterviewSchedule = require('../models/InterviewSchedule');
const hrService = require('./hrService');

// Stage order the pipeline is expected to move forward through.
// 'rejected' is reachable from any stage (a candidate can be rejected at
// any point), so it's handled as a special case rather than being part
// of this ordered list.
const STAGE_ORDER = ['applied', 'screening', 'interview', 'offer', 'hired'];

// --- Job openings ----------------------------------------------------------

function createJobOpening(input) {
  const { companyId, branchId, title, departmentId, description, numberOfPositions, postedByUserId } = input;
  if (!title) throw new Error('Job opening title is required.');
  return JobOpening.create({ companyId, branchId, title, departmentId, description, numberOfPositions, postedByUserId });
}

async function closeJobOpening(jobOpeningId) {
  const opening = await JobOpening.findByIdAndUpdate(
    jobOpeningId, { status: 'closed', closedAt: new Date() }, { new: true }
  );
  if (!opening) throw new Error('Job opening not found.');
  return opening;
}

function listJobOpenings(companyId, filter = {}) {
  const query = { companyId };
  if (filter.status) query.status = filter.status;
  return JobOpening.find(query).sort({ createdAt: -1 });
}

// --- Candidates --------------------------------------------------------------

async function addCandidate(input) {
  const { companyId, jobOpeningId, name, email, phone, resumeNote, source } = input;
  if (!name) throw new Error('Candidate name is required.');
  const opening = await JobOpening.findOne({ _id: jobOpeningId, companyId });
  if (!opening) throw new Error('Job opening not found.');
  return Candidate.create({ companyId, jobOpeningId, name, email, phone, resumeNote, source });
}

function listCandidates(filter = {}) {
  const query = {};
  if (filter.companyId) query.companyId = filter.companyId;
  if (filter.jobOpeningId) query.jobOpeningId = filter.jobOpeningId;
  if (filter.stage) query.stage = filter.stage;
  return Candidate.find(query).populate('jobOpeningId', 'title').sort({ createdAt: -1 });
}

/**
 * Moves a candidate to a new stage. Enforces the pipeline moves forward
 * (applied -> screening -> interview -> offer -> hired), or sideways into
 * 'rejected' from any non-terminal stage. 'hired' is NOT settable here —
 * hireCandidate() is the only path into 'hired' since it also has to
 * create the Employee record.
 */
async function moveStage(candidateId, newStage, { rejectionReason } = {}) {
  const candidate = await Candidate.findById(candidateId);
  if (!candidate) throw new Error('Candidate not found.');

  if (candidate.stage === 'hired' || candidate.stage === 'rejected') {
    throw new Error(`Candidate is already ${candidate.stage} and cannot move further.`);
  }

  if (newStage === 'hired') {
    throw new Error('Use hireCandidate() to move a candidate to the hired stage.');
  }

  if (newStage === 'rejected') {
    if (!rejectionReason) throw new Error('rejectionReason is required when rejecting a candidate.');
    candidate.stage = 'rejected';
    candidate.rejectionReason = rejectionReason;
    await candidate.save();
    return candidate;
  }

  const currentIndex = STAGE_ORDER.indexOf(candidate.stage);
  const nextIndex = STAGE_ORDER.indexOf(newStage);
  if (nextIndex === -1) throw new Error(`Invalid stage "${newStage}".`);
  if (nextIndex <= currentIndex) {
    throw new Error(`Cannot move from "${candidate.stage}" back to "${newStage}": stages only move forward.`);
  }
  if (nextIndex !== currentIndex + 1) {
    throw new Error(`Cannot skip stages: candidate is at "${candidate.stage}", next stage must be "${STAGE_ORDER[currentIndex + 1]}".`);
  }

  candidate.stage = newStage;
  await candidate.save();
  return candidate;
}

// --- Interviews --------------------------------------------------------------

async function scheduleInterview(input) {
  const { companyId, candidateId, scheduledAt, interviewerUserId, mode } = input;
  if (!scheduledAt) throw new Error('scheduledAt is required.');
  const candidate = await Candidate.findOne({ _id: candidateId, companyId });
  if (!candidate) throw new Error('Candidate not found.');
  return InterviewSchedule.create({ companyId, candidateId, scheduledAt, interviewerUserId, mode });
}

async function recordInterviewFeedback(interviewId, { feedback, rating }) {
  const interview = await InterviewSchedule.findById(interviewId);
  if (!interview) throw new Error('Interview not found.');
  if (rating != null && (rating < 1 || rating > 5)) throw new Error('rating must be between 1 and 5.');
  interview.feedback = feedback ?? interview.feedback;
  if (rating != null) interview.rating = rating;
  interview.completedAt = new Date();
  await interview.save();
  return interview;
}

// --- Hiring --------------------------------------------------------------

/**
 * Converts a hired candidate into a real Employee. Requires the candidate
 * to already be at 'offer' or 'hired' stage (an offer must have been
 * extended before a hire is recorded). Calls hrService.createEmployee()
 * — the exact same function the core HR "Add employee" flow uses — so no
 * Employee-creation logic is duplicated here. On success, marks the
 * candidate 'hired' and links employeeId.
 */
async function hireCandidate(candidateId, employeeFields = {}) {
  const candidate = await Candidate.findById(candidateId);
  if (!candidate) throw new Error('Candidate not found.');

  if (!['offer', 'hired'].includes(candidate.stage)) {
    throw new Error(`Candidate must be at "offer" stage or later to be hired (currently "${candidate.stage}").`);
  }
  if (candidate.employeeId) {
    throw new Error('Candidate has already been hired and linked to an employee.');
  }

  const employee = await hrService.createEmployee({
    name: candidate.name,
    phone: candidate.phone,
    ...employeeFields,
    companyId: candidate.companyId,
  });

  candidate.stage = 'hired';
  candidate.employeeId = employee._id;
  await candidate.save();

  return { candidate, employee };
}

// --- Reporting --------------------------------------------------------------

async function pipelineSummary(companyId) {
  const rows = await Candidate.aggregate([
    { $match: { companyId: typeof companyId === 'string' ? new (require('mongoose').Types.ObjectId)(companyId) : companyId } },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
  ]);
  const summary = { applied: 0, screening: 0, interview: 0, offer: 0, hired: 0, rejected: 0 };
  for (const row of rows) summary[row._id] = row.count;
  return summary;
}

module.exports = {
  createJobOpening, closeJobOpening, listJobOpenings,
  addCandidate, listCandidates, moveStage,
  scheduleInterview, recordInterviewFeedback,
  hireCandidate, pipelineSummary,
};
