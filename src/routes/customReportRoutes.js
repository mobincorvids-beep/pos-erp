const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { REPORTS_VIEW } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/customReportController');

router.use(requireAuth, scopeToCompany, requirePermission(REPORTS_VIEW));

router.get('/sources', controller.sources); // allowlisted sources + their reportable fields, for the report-builder UI
router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/',
  body('name').isString().notEmpty().withMessage('name is required.'),
  body('sourceCollection').isString().notEmpty().withMessage('sourceCollection is required.'),
  validate, controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);
router.get('/:id/run', controller.run);
router.post('/preview', controller.preview); // run an unsaved spec — same body shape as create, minus a saved name

module.exports = router;
