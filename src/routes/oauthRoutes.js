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
  // Two entry points, one callback. `state` here is a plain string (not
  // `state: true`), so passport-oauth2 round-trips it verbatim on the
  // redirect back from Google without needing session support (this app
  // runs OAuth fully stateless, session: false throughout) — see
  // oauthController.googleCallback, which reads it back as
  // req.authInfo.state to decide whether "no existing account found" is
  // allowed to self-serve-create a brand-new tenant (signup) or should
  // refuse with a clear message (login).
  router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: 'login' }));
  router.get('/google/signup', passport.authenticate('google', { scope: ['profile', 'email'], session: false, state: 'signup' }));
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
