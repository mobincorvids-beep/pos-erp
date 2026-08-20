const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { login, register, forgotPassword, resetPassword, refresh, logout, me } = require('../controllers/authController');

const loginValidation = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

const registerValidation = [
  body('companyName').isString().trim().notEmpty().withMessage('Company name is required.'),
  body('industryType').optional().isString().trim(),
  body('adminName').isString().trim().notEmpty().withMessage('Your name is required.'),
  body('adminEmail').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('adminPassword').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];

const forgotPasswordValidation = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
];

const resetPasswordValidation = [
  body('token').isString().notEmpty().withMessage('Reset token is required.'),
  body('newPassword').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];

router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/register', authLimiter, registerValidation, validate, register);
router.post('/forgot-password', authLimiter, forgotPasswordValidation, validate, forgotPassword);
router.post('/reset-password', authLimiter, resetPasswordValidation, validate, resetPassword);
router.post('/refresh', authLimiter, body('refreshToken').isString().notEmpty(), validate, refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

module.exports = router;
