const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth, scopeToCompany, requirePermission } = require('../middleware/auth');
const { USERS_MANAGE } = require('../constants/permissions');
const { validate } = require('../middleware/validate');
const controller = require('../controllers/userController');

const createValidation = [
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];

router.use(requireAuth, scopeToCompany);
router.get('/', controller.list);
router.post('/', requirePermission(USERS_MANAGE), createValidation, validate, controller.create);
router.patch('/:id/active', requirePermission(USERS_MANAGE), controller.setActive);
router.patch('/:id/role', requirePermission(USERS_MANAGE), controller.assignRole);
router.post('/:id/reset-password', requirePermission(USERS_MANAGE), controller.resetPassword);

module.exports = router;
