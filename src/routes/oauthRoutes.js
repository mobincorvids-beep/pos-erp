/**
 * SSO/OAuth routes. Mounted at /auth alongside authRoutes.js (see
 * routes/index.js), so the final paths are /api/v1/auth/google etc.
 *
 * GET /auth/oauth-providers is always registered (returns which
 * providers are configured, so the frontend knows whether to show a
 * "Sign in with Google" button at all). The actual /auth/google and
 * /auth/google/callback routes are only registered when Google OAuth is
 * configured (see src/config/passport.js) — requesting them when it
 * isn't configured 404s exactly like any other nonexistent route, rather
 * than 500ing on a half-configured passport strategy.
 */
const router = require('express').Router();
const { passport, googleEnabled, microsoftEnabled } = require('../config/passport');
const { googleCallback } = require('../controllers/oauthController');

router.get('/oauth-providers', (req, res) => {
  res.json({ google: googleEnabled, microsoft: microsoftEnabled });
});

if (googleEnabled) {
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: '/login' }),
    googleCallback
  );
}

// Microsoft/Azure AD: once src/config/passport.js registers a
// 'microsoft' strategy the same way it registers 'google' above, add its
// GET /microsoft and GET /microsoft/callback routes here, guarded by
// `if (microsoftEnabled)`, pointing at a microsoftCallback controller
// built the same way as googleCallback.

module.exports = router;
