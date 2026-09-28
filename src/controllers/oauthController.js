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
 *
 * A brand-new "Sign up with Google" identity is a third outcome, neither
 * success nor failure: oauthService.findOrLinkUser returns a
 * `pendingSignup` marker instead of a user, and this controller signs
 * those verified profile fields into a short-lived JWT (same
 * jwt.sign(..., JWT_SECRET, { expiresIn }) pattern authController.js uses
 * for its own preAuthToken flows) and redirects to /complete-signup with
 * it — the frontend's CompleteGoogleSignupPage.jsx collects the business
 * name + industry the password-signup form always asks for, then POSTs
 * that token + those fields to POST /auth/google/complete-signup below to
 * actually provision the company.
 */
const jwt = require('jsonwebtoken');
const { deviceContext, issueTokensForUser } = require('./authController');
const oauthService = require('./../services/oauthService');

const PENDING_SIGNUP_EXPIRY = '30m';

function frontendBaseUrl() {
  // Same CLIENT_ORIGIN app.js already validates CORS against — the first
  // entry when it's a comma-separated list — falling back to the local
  // Vite dev server so this works out of the box in local dev too.
  return (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
}

function signPendingSignupToken(profile) {
  return jwt.sign(
    {
      pendingOAuthSignup: true,
      provider: profile.provider,
      providerId: profile.providerId,
      email: profile.email,
      displayName: profile.displayName,
    },
    process.env.JWT_SECRET,
    { expiresIn: PENDING_SIGNUP_EXPIRY }
  );
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
    const result = await oauthService.findOrLinkUser('google', req.user, { allowSelfServeSignup });

    if (result.pendingSignup) {
      const pendingToken = signPendingSignupToken(result);
      res.redirect(`${base}/complete-signup?pending=${encodeURIComponent(pendingToken)}`);
      return;
    }

    const user = result;
    if (!user.isActive) {
      return res.redirect(`${base}/login?oauth_error=${encodeURIComponent('This account is disabled.')}`);
    }
    const { token, refreshToken } = await issueTokensForUser(user, deviceContext(req));
    res.redirect(`${base}/oauth-complete?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}`);
  } catch (err) {
    res.redirect(`${base}/login?oauth_error=${encodeURIComponent(err.message || 'Google sign-in failed.')}`);
  }
}

/**
 * POST /auth/google/complete-signup — the second step of the Google
 * signup flow, called via fetch (JSON in/out, not a redirect) from
 * CompleteGoogleSignupPage.jsx once the user has picked a business name
 * and industry. Verifies the short-lived pending token minted by
 * googleCallback above, then provisions the company exactly like the
 * password-based signup form does.
 */
async function completeGoogleSignup(req, res) {
  const { pendingToken, businessName, industryType } = req.body;
  if (!pendingToken) return res.status(400).json({ error: 'pendingToken is required.' });
  if (!businessName) return res.status(400).json({ error: 'Business name is required.' });
  if (!industryType) return res.status(400).json({ error: 'Business type is required.' });

  let decoded;
  try {
    decoded = jwt.verify(pendingToken, process.env.JWT_SECRET);
  } catch {
    return res.status(400).json({ error: 'This signup link has expired. Please click "Sign up with Google" again.' });
  }
  if (!decoded.pendingOAuthSignup) return res.status(400).json({ error: 'Invalid signup token.' });

  try {
    const admin = await oauthService.completeSelfServeSignup({
      provider: decoded.provider,
      providerId: decoded.providerId,
      email: decoded.email,
      displayName: decoded.displayName,
      businessName,
      industryType,
    });
    const { token, refreshToken } = await issueTokensForUser(admin, deviceContext(req));
    res.json({ token, refreshToken });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Could not complete signup.' });
  }
}

module.exports = { googleCallback, completeGoogleSignup };
