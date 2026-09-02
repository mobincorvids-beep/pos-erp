/**
 * Passport configuration — registers OAuth strategies ONLY when their env
 * vars are actually configured, so this file is always safe to require:
 * no crash, no console spam, in an environment (like this sandbox) that
 * has none of them set. `googleEnabled` / `microsoftEnabled` are the
 * single source of truth other modules (routes, the frontend-facing
 * /auth/oauth-providers endpoint) use to decide whether to expose that
 * provider at all.
 *
 * --- Real-deployment setup: Google ---
 * Set these three env vars (see .env.example):
 *   GOOGLE_CLIENT_ID
 *   GOOGLE_CLIENT_SECRET
 *   GOOGLE_CALLBACK_URL   (e.g. https://api.yourapp.com/api/v1/auth/google/callback)
 * Get them from Google Cloud Console: console.cloud.google.com ->
 * APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
 * (Web application) -> add GOOGLE_CALLBACK_URL under "Authorized redirect
 * URIs". You'll also need to configure the OAuth consent screen there
 * first (scopes: profile, email are all this app requests).
 *
 * --- Adding Microsoft/Azure AD later ---
 * Follow the exact same shape: install passport-azure-ad (or
 * passport-microsoft), gate registration on
 * MICROSOFT_CLIENT_ID/MICROSOFT_CLIENT_SECRET/MICROSOFT_CALLBACK_URL
 * being set, set microsoftEnabled = true when they are, and add the
 * verify callback below next to Google's. src/services/oauthService.js
 * already accepts 'microsoft' as a provider and src/routes/oauthRoutes.js
 * is written to add its routes the same way Google's are added — no
 * other file needs to change.
 */
const passport = require('passport');

let googleEnabled = false;
const microsoftEnabled = false; // flip on once a Microsoft strategy is wired up the same way as Google's below

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  passport.use('google', new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    // We don't need the access/refresh token Google issues for its own
    // APIs — this app only wants the verified identity. The real
    // find-or-link-or-reject logic lives in src/services/oauthService.js,
    // called from the callback route, not here — keeping this file pure
    // strategy wiring.
    (_accessToken, _refreshToken, profile, done) => done(null, profile)
  ));
  googleEnabled = true;
} else if (process.env.NODE_ENV !== 'test') {
  console.log('ℹ Google OAuth is not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_CALLBACK_URL not set) — "Sign in with Google" is disabled. See src/config/passport.js for setup.');
}

module.exports = { passport, googleEnabled, microsoftEnabled };
