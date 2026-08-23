const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { login, register, verifyTwoFactor, refresh, logout, me, setupTwoFactor, confirmTwoFactor, disableTwoFactor, listSessions, revokeSession, listLoginHistory } = require('../controllers/authController');

const loginValidation = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

// Public self-signup — a brand-new business creates its own isolated
// tenant (own Company, own admin user, own data from row one). No auth
// required to reach it (there's no session yet), but it shares the same
// rate limiter as login since it's an equally sensitive, abuse-prone,
// unauthenticated endpoint.
const registerValidation = [
  body('businessName').isString().trim().isLength({ min: 2 }).withMessage('Business name is required.'),
  body('industryType').isString().trim().notEmpty().withMessage('Please choose your business type.'),
  body('adminName').isString().trim().isLength({ min: 2 }).withMessage('Your name is required.'),
  body('adminEmail').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('adminPassword').isString().isLength({ min: 8 }).withMessage('Password must be at least 8 characters.'),
];

router.post('/login', authLimiter, loginValidation, validate, login);
router.post('/register', authLimiter, registerValidation, validate, register);
// Rate-limited the same as login itself — a 2FA code is exactly the kind
// of short, guessable-by-brute-force value that needs the same protection
// login's password field already gets, not weaker protection just because
// it's a second step.
router.post('/verify-2fa', authLimiter, body('preAuthToken').isString().notEmpty(), body('token').isString().notEmpty(), validate, verifyTwoFactor);
router.post('/refresh', authLimiter, body('refreshToken').isString().notEmpty(), validate, refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

router.post('/2fa/setup', requireAuth, setupTwoFactor);
router.post('/2fa/confirm', requireAuth, authLimiter, body('token').isString().notEmpty().withMessage('token is required.'), validate, confirmTwoFactor);
router.post('/2fa/disable', requireAuth, body('password').isString().notEmpty().withMessage('password is required.'), validate, disableTwoFactor);

router.get('/sessions', requireAuth, listSessions);
router.post('/sessions/:id/revoke', requireAuth, revokeSession);
router.get('/login-history', requireAuth, listLoginHistory);

module.exports = router;
