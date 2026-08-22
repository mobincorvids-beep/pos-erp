const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/billOfQuantitiesController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('construction'));

router.post('/boqs',
  body('projectId').isString().notEmpty().withMessage('projectId is required.'),
  body('title').isString().trim().notEmpty().withMessage('title is required.'),
  body('lineItems').isArray({ min: 1 }).withMessage('At least one line item is required.'),
  body('lineItems.*.description').isString().trim().notEmpty().withMessage('Each line item needs a description.'),
  body('lineItems.*.estimatedQuantity').isFloat({ gt: 0 }).withMessage('Each line item needs estimatedQuantity > 0.'),
  body('lineItems.*.estimatedRate').isFloat({ gt: 0 }).withMessage('Each line item needs estimatedRate > 0.'),
  body('lineItems.*.costType').isIn(['material', 'labor', 'expense', 'purchase', 'manual']).withMessage('Invalid costType.'),
  validate, controller.createBOQ);
router.get('/boqs', controller.listBOQs); // ?projectId=
router.get('/boqs/:id', controller.getBOQ);
router.get('/boqs/:id/variance', controller.varianceReport);

module.exports = router;
