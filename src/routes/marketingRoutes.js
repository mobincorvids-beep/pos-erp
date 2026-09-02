const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { MARKETING_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/marketingController');

// Audience segments + marketing automation journeys. Mounted at
// /marketing (see src/routes/index.js). Everything here is
// authenticated/company-scoped — unlike Funnels there is no public side.
router.use(requireAuth, scopeToCompany);

// --- Segments -----------------------------------------------------------

router.get('/segments', controller.listSegments);
router.post('/segments',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  validate, requirePermission(MARKETING_MANAGE), controller.createSegment);
router.get('/segments/:id', controller.getSegment);
router.put('/segments/:id', requirePermission(MARKETING_MANAGE), controller.updateSegment);
router.delete('/segments/:id', requirePermission(MARKETING_MANAGE), controller.deleteSegment);
router.get('/segments/:id/preview', controller.previewSegment);

// --- Journeys ---------------------------------------------------------

router.get('/journeys', controller.listJourneys);
router.post('/journeys',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  validate, requirePermission(MARKETING_MANAGE), controller.createJourney);
router.get('/journeys/:id', controller.getJourney);
router.put('/journeys/:id', requirePermission(MARKETING_MANAGE), controller.updateJourney);
router.delete('/journeys/:id', requirePermission(MARKETING_MANAGE), controller.deleteJourney);
router.post('/journeys/:id/start', requirePermission(MARKETING_MANAGE), controller.startJourney);
router.post('/journeys/:id/pause', requirePermission(MARKETING_MANAGE), controller.pauseJourney);
router.post('/journeys/:id/enroll-segment', requirePermission(MARKETING_MANAGE), controller.enrollSegment);
router.post('/journeys/:id/enroll-customer', requirePermission(MARKETING_MANAGE), controller.enrollCustomer);
router.get('/journeys/:id/stats', controller.journeyStats);

module.exports = router;
