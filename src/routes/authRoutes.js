const router = require('express').Router();
const { body } = require('express-validator');
const { requireAuth } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { validate } = require('../middleware/validate');
const { login, verifyTwoFactor, refresh, logout, me, setupTwoFactor, confirmTwoFactor, disableTwoFactor, listSessions, revokeSession, listLoginHistory } = require('../controllers/authController');

const loginValidation = [
  body('email').isEmail().withMessage('A valid email is required.').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required.'),
];

router.post('/login', authLimiter, loginValidation, validate, login);
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
