const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/markdownController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('fashion'));

router.get('/markdown-schedules', controller.listSchedules);
router.post('/markdown-schedules',
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('variantId').isString().notEmpty().withMessage('variantId is required.'),
  body('stages').isArray({ min: 1 }).withMessage('At least one stage is required.'),
  body('stages.*.daysSinceLaunch').isInt({ min: 0 }).withMessage('Each stage needs a non-negative daysSinceLaunch.'),
  body('stages.*.discountPercent').isFloat({ min: 0, max: 100 }).withMessage('Each stage needs a discountPercent between 0 and 100.'),
  validate, controller.setSchedule);
router.get('/markdown-schedules/:variantId', controller.getSchedule);
router.get('/items/:variantId/current-price', controller.currentPrice);

module.exports = router;
