const JobOpening = require('../models/JobOpening');
const Candidate = require('../models/Candidate');
const InterviewSchedule = require('../models/InterviewSchedule');
const recruitmentService = require('../services/recruitmentService');

// --- Job openings ----------------------------------------------------------

async function createJobOpening(req, res) {
  try {
    const opening = await recruitmentService.createJobOpening({ ...req.body, companyId: req.companyId, postedByUserId: req.auth.userId });
    res.status(201).json(opening);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listJobOpenings(req, res) {
  const rows = await recruitmentService.listJobOpenings(req.companyId, { status: req.query.status });
  res.json(rows);
}

async function getJobOpening(req, res) {
  const opening = await JobOpening.findOne({ _id: req.params.id, companyId: req.companyId }).populate('departmentId', 'name');
  if (!opening) return res.status(404).json({ error: 'Job opening not found.' });
  res.json(opening);
}

async function closeJobOpening(req, res) {
  try {
    const opening = await recruitmentService.closeJobOpening(req.params.id);
    res.json(opening);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Candidates --------------------------------------------------------------

async function addCandidate(req, res) {
  try {
    const candidate = await recruitmentService.addCandidate({ ...req.body, companyId: req.companyId });
    res.status(201).json(candidate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listCandidates(req, res) {
  const rows = await recruitmentService.listCandidates({ companyId: req.companyId, jobOpeningId: req.query.jobOpeningId, stage: req.query.stage });
  res.json(rows);
}

async function getCandidate(req, res) {
  const candidate = await Candidate.findOne({ _id: req.params.id, companyId: req.companyId }).populate('jobOpeningId', 'title');
  if (!candidate) return res.status(404).json({ error: 'Candidate not found.' });
  const interviews = await InterviewSchedule.find({ candidateId: candidate._id }).sort({ scheduledAt: -1 });
  res.json({ candidate, interviews });
}

async function moveStage(req, res) {
  try {
    const candidate = await recruitmentService.moveStage(req.params.id, req.body.stage, { rejectionReason: req.body.rejectionReason });
    res.json(candidate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function hireCandidate(req, res) {
  try {
    const result = await recruitmentService.hireCandidate(req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Interviews --------------------------------------------------------------

async function scheduleInterview(req, res) {
  try {
    const interview = await recruitmentService.scheduleInterview({ ...req.body, companyId: req.companyId });
    res.status(201).json(interview);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function recordInterviewFeedback(req, res) {
  try {
    const interview = await recruitmentService.recordInterviewFeedback(req.params.id, { feedback: req.body.feedback, rating: req.body.rating });
    res.json(interview);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Reporting --------------------------------------------------------------

async function pipelineSummary(req, res) {
  const summary = await recruitmentService.pipelineSummary(req.companyId);
  res.json(summary);
}

module.exports = {
  createJobOpening, listJobOpenings, getJobOpening, closeJobOpening,
  addCandidate, listCandidates, getCandidate, moveStage, hireCandidate,
  scheduleInterview, recordInterviewFeedback,
  pipelineSummary,
};
