const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { KNOWLEDGE_BASE_MANAGE } = require('../constants/permissions');
const controller = require('../controllers/knowledgeBaseController');

router.use(requireAuth, scopeToCompany);

// Viewing/searching/voting/recording a view is open to any authenticated
// user regardless of role (same split as DOCUMENTS_VIEW vs
// DOCUMENTS_MANAGE) — only authoring/publishing/deleting is gated.
router.get('/', controller.listArticles); // ?status=&category=&tag=&q=
router.get('/suggest', controller.suggest); // ?query= — used both standalone and by ticket composition
router.get('/:id', controller.getArticle);
router.post('/:id/view', controller.recordView);
router.post('/:id/vote', body('helpful').isBoolean().withMessage('helpful must be a boolean.'), validate, controller.voteArticle);

router.post('/',
  requirePermission(KNOWLEDGE_BASE_MANAGE),
  body('title').isString().trim().notEmpty().withMessage('title is required.'),
  body('body').isString().trim().notEmpty().withMessage('body is required.'),
  validate, controller.createArticle);
router.put('/:id', requirePermission(KNOWLEDGE_BASE_MANAGE), controller.updateArticle);
router.delete('/:id', requirePermission(KNOWLEDGE_BASE_MANAGE), controller.deleteArticle);
router.post('/:id/publish', requirePermission(KNOWLEDGE_BASE_MANAGE), controller.publishArticle);
router.post('/:id/unpublish', requirePermission(KNOWLEDGE_BASE_MANAGE), controller.unpublishArticle);

module.exports = router;
