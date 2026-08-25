const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../../../middleware/auth');
const { requireActiveModule } = require('../../../middleware/requireActiveModule');
const { validate } = require('../../../middleware/validate');
const controller = require('../controllers/batchRecallController');

router.use(requireAuth, scopeToCompany);
router.use(requireActiveModule('pharmaceutical'));

router.post('/recalls',
  body('batchId').isString().notEmpty().withMessage('batchId is required.'),
  body('productId').isString().notEmpty().withMessage('productId is required.'),
  body('reason').isString().trim().notEmpty().withMessage('reason is required.'),
  validate, controller.initiateRecall);
router.get('/recalls', controller.listRecalls); // ?status=
router.get('/recalls/:id', controller.getRecall);
router.put('/recalls/:id', body('reason').optional().isString().trim().notEmpty().withMessage('reason cannot be empty.'), validate, controller.updateRecall);
router.post('/recalls/:id/returns',
  body('customerId').isString().notEmpty().withMessage('customerId is required.'),
  body('quantity').isFloat({ gt: 0 }).withMessage('quantity must be greater than zero.'),
  validate, controller.recordReturn);
router.post('/recalls/:id/close', controller.closeRecall);

module.exports = router;
