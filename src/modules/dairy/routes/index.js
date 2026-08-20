const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/dairyController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('dairy'));

router.post('/quality-schedules',
  body('name').isString().trim().notEmpty().withMessage('name is required.'),
  body('bands').isArray({ min: 1 }).withMessage('At least one band is required.'),
  validate, controller.createSchedule);
router.post('/collections',
  body('branchId').isString().notEmpty().withMessage('branchId is required.'),
  body('supplierId').isString().notEmpty().withMessage('supplierId is required.'),
  body('litres').isFloat({ gt: 0 }).withMessage('litres must be greater than zero.'),
  body('fatPercent').isFloat({ gt: 0 }).withMessage('fatPercent is required.'),
  body('scheduleId').isString().notEmpty().withMessage('scheduleId is required.'),
  validate, controller.recordCollection);
router.get('/collections', controller.listCollections);

module.exports = router;
