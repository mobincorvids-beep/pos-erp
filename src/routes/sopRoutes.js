const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { PURCHASE_CREATE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/sopController');

router.use(requireAuth, scopeToCompany, requirePermission(PURCHASE_CREATE));

router.get('/', controller.list); // ?status=draft|under_review|approved|rejected|closed
router.get('/:id', controller.get);
router.get('/:id/variance', controller.variance);

router.post('/generate',
  body('period').matches(/^\d{4}-\d{2}$/).withMessage('period must be YYYY-MM.'),
  body('productIds').isArray({ min: 1 }).withMessage('productIds must be a non-empty array.'),
  validate, controller.generate);

router.patch('/:id/lines/:productId', controller.updateLine);
router.post('/:id/submit', controller.submit);
router.post('/:id/decide', body('approve').isBoolean().withMessage('approve must be true/false.'), validate, controller.decide);
router.post('/:id/close', controller.close);

module.exports = router;
