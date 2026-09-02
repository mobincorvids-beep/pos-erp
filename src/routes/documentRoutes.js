const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/documentController');

router.use(requireAuth, scopeToCompany);

// fileUrl (an already-hosted URL) and fileData (an inline base64 data-URI,
// see Document.js) are both optional individually — a version needs
// exactly one of them, which documentController's validateFile() enforces
// since express-validator's body() chains can't express "either/or" this
// cleanly across two independent optional fields.
router.post('/',
  body('entityType').isString().trim().notEmpty().withMessage('entityType is required.'),
  body('entityId').isString().notEmpty().withMessage('entityId is required.'),
  body('category').isString().trim().notEmpty().withMessage('category is required.'),
  body('fileUrl').optional({ nullable: true }).isString().trim(),
  body('fileData').optional({ nullable: true }).isString(),
  body('fileName').isString().trim().notEmpty().withMessage('fileName is required.'),
  body('mimeType').optional({ nullable: true }).isString(),
  validate, controller.createDocument);
router.get('/', controller.listDocuments); // ?entityType=&entityId=&category=
router.post('/:id/versions',
  body('fileUrl').optional({ nullable: true }).isString().trim(),
  body('fileData').optional({ nullable: true }).isString(),
  body('fileName').isString().trim().notEmpty().withMessage('fileName is required.'),
  body('mimeType').optional({ nullable: true }).isString(),
  validate, controller.uploadVersion);
router.post('/:id/request-approval', controller.requestApproval);
router.get('/expiring/check', controller.checkExpiring); // ?daysAhead= (default 30) — real trigger for the expiry-notification sweep

module.exports = router;
