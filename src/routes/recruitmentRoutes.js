const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { RECRUITMENT_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/recruitmentController');

router.use(requireAuth, scopeToCompany, requirePermission(RECRUITMENT_MANAGE));

// Job openings
router.get('/job-openings', controller.listJobOpenings); // ?status=
router.post('/job-openings', body('title').isString().trim().notEmpty().withMessage('Title is required.'), validate, controller.createJobOpening);
router.get('/job-openings/:id', controller.getJobOpening);
router.post('/job-openings/:id/close', controller.closeJobOpening);

// Candidates
router.get('/candidates', controller.listCandidates); // ?jobOpeningId=&stage=
router.post('/candidates',
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('jobOpeningId').isString().notEmpty().withMessage('jobOpeningId is required.'),
  validate, controller.addCandidate);
router.get('/candidates/:id', controller.getCandidate);
router.post('/candidates/:id/move-stage', body('stage').isString().notEmpty().withMessage('stage is required.'), validate, controller.moveStage);
router.post('/candidates/:id/hire', controller.hireCandidate);

// Interviews
router.post('/interviews', body('candidateId').isString().notEmpty().withMessage('candidateId is required.'), body('scheduledAt').notEmpty().withMessage('scheduledAt is required.'), validate, controller.scheduleInterview);
router.post('/interviews/:id/feedback', controller.recordInterviewFeedback);

// Reporting
router.get('/pipeline-summary', controller.pipelineSummary);

module.exports = router;
