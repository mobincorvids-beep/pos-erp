const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/tradeInController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('automobile'));

router.post('/trade-ins',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('appraisedValue').isFloat({ gt: 0 }).withMessage('appraisedValue must be greater than zero.'),
  validate, controller.intake);
router.post('/trade-ins/:id/apply', body('saleId').isString().notEmpty().withMessage('saleId is required.'), validate, controller.markApplied);
router.get('/trade-ins', controller.listCredits);

module.exports = router;
