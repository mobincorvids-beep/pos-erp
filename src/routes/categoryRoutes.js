const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { CATEGORIES_VIEW, CATEGORIES_CREATE, CATEGORIES_EDIT, CATEGORIES_DELETE } = require('../constants/permissions');
const controller = require('../controllers/categoryController');

router.use(requireAuth, scopeToCompany);

router.get('/', requirePermission(CATEGORIES_VIEW), controller.list);
router.get('/tree', requirePermission(CATEGORIES_VIEW), controller.tree);
router.post('/',
  requirePermission(CATEGORIES_CREATE),
  body('name').isString().trim().notEmpty().withMessage('Category name is required.'),
  validate, controller.create);
router.post('/reseed-defaults', requirePermission(CATEGORIES_CREATE), controller.reseedDefaults);
router.put('/:id', requirePermission(CATEGORIES_EDIT), controller.update);
router.delete('/:id', requirePermission(CATEGORIES_DELETE), controller.remove);

module.exports = router;
