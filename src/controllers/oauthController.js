/**
 * Completes an OAuth (currently: Google) login. By the time this runs,
 * passport's strategy middleware has already exchanged the provider's
 * authorization code and populated req.user with the verified profile
 * (see src/config/passport.js) — this controller's only job is to turn
 * that profile into an app User (src/services/oauthService.js) and issue
 * the exact same access+refresh token pair local login issues
 * (authController.issueTokensForUser — deliberately reused, not
 * reimplemented, so OAuth sessions behave identically to password
 * sessions everywhere else in the app).
 *
 * Because this is a real browser redirect flow (not a fetch/XHR call),
 * both success and failure are communicated by redirecting the browser
 * back to the frontend rather than returning JSON — the frontend route
 * /oauth-complete (client/src/pages/OAuthCompletePage.jsx) reads the
 * tokens (or error) off the URL and takes it from there.
 */
const { deviceContext, issueTokensForUser } = require('./authController');
const oauthService = require('./../services/oauthService');

function frontendBaseUrl() {
  // Same CLIENT_ORIGIN app.js already validates CORS against — the first
  // entry when it's a comma-separated list — falling back to the local
  // Vite dev server so this works out of the box in local dev too.
  return (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
}

async function googleCallback(req, res) {
  const base = frontendBaseUrl();
  try {
    // req.user._oauthState is stashed by the verify callback in
    // src/config/passport.js (passport's own state-store round-trip drops
    // it under session:false — see that file's comment for why we don't
    // rely on it) — round-trips whatever `state` GET /auth/google (or
    // /auth/google/signup) passed to passport.authenticate. Only the
    // /signup entry point is allowed to create a brand-new tenant when no
    // existing account matches.
    const allowSelfServeSignup = req.user?._oauthState === 'signup';
    const user = await oauthService.findOrLinkUser('google', req.user, { allowSelfServeSignup });
    if (!user.isActive) {
      return res.redirect(`${base}/login?oauth_error=${encodeURIComponent('This account is disabled.')}`);
    }
    const { token, refreshToken } = await issueTokensForUser(user, deviceContext(req));
    res.redirect(`${base}/oauth-complete?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`);
  } catch (err) {
    res.redirect(`${base}/login?oauth_error=${encodeURIComponent(err.message || 'Google sign-in failed.')}`);
  }
}

module.exports = { googleCallback };
