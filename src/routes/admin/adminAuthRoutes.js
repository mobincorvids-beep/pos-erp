const router = require('express').Router();
const { body } = require('express-validator');
const { requirePlatformAdmin, requireAdminRole } = require('../../middleware/platformAuth');
const { authLimiter } = require('../../middleware/rateLimit');
const { validate } = require('../../middleware/validate');
const { login, refresh, logout, me, createAdmin, resetPassword } = require('../../controllers/admin/adminAuthController');

const loginValidation = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];
const createAdminValidation = [
  body('name').isString().trim().notEmpty().withMessage('Name is required.'),
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('role').optional().isIn(['admin', 'support']).withMessage('role must be "admin" or "support".'),
];

router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/refresh', authLimiter, body('refreshToken').isString().notEmpty(), validate, refresh);
router.post('/logout', logout);
router.get('/me', requirePlatformAdmin, me);
router.post('/admins', requirePlatformAdmin, requireAdminRole, createAdminValidation, validate, createAdmin);
router.post('/admins/:id/reset-password', requirePlatformAdmin, requireAdminRole, resetPassword);

module.exports = router;
