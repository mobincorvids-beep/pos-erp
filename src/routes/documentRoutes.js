const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/documentController');

router.use(requireAuth, scopeToCompany);

router.post('/',
  body('entityType').isString().trim().notEmpty().withMessage('entityType is required.'),
  body('entityId').isString().notEmpty().withMessage('entityId is required.'),
  body('category').isString().trim().notEmpty().withMessage('category is required.'),
  body('fileUrl').isString().trim().notEmpty().withMessage('fileUrl is required.'),
  body('fileName').isString().trim().notEmpty().withMessage('fileName is required.'),
  validate, controller.createDocument);
router.get('/', controller.listDocuments); // ?entityType=&entityId=&category=
router.post('/:id/versions', body('fileUrl').isString().trim().notEmpty().withMessage('fileUrl is required.'), body('fileName').isString().trim().notEmpty().withMessage('fileName is required.'), validate, controller.uploadVersion);
router.post('/:id/request-approval', controller.requestApproval);
router.get('/expiring/check', controller.checkExpiring); // ?daysAhead= (default 30) — real trigger for the expiry-notification sweep

module.exports = router;
