/**
 * OAuthService — turns a verified provider profile (Google today,
 * structured so Microsoft/Azure AD can be added the same way tomorrow)
 * into an existing app User, WITHOUT ever creating a new company/tenant
 * on its own. Three cases, in order:
 *
 *   1. This provider identity (provider + providerId) is already linked
 *      to a User — sign them straight in.
 *   2. It isn't linked yet, but its email matches an existing LOCAL
 *      User's email — auto-link the two identities so someone who signed
 *      up locally as jane@acme.com can also sign in with Google using the
 *      same address, going forward.
 *   3. No match at all — refuse. This app is multi-tenant; a bare email
 *      match with no verification is exactly how account-takeover bugs
 *      happen (control an email at the OAuth provider, walk into
 *      whatever local account happens to share it), so step 2 requires
 *      the provider's OWN assertion that it verified the email
 *      (profile.emails[0].verified from passport-google-oauth20 — Google
 *      only sets this true for Google Workspace / consumer accounts it
 *      has itself confirmed the mailbox for). If that flag is ever
 *      missing or unreliable for a given provider, tighten this further
 *      rather than loosen it — do NOT fall back to matching by email
 *      alone.
 *
 * Self-serve tenant creation via OAuth: case 3 below USED to always
 * refuse. It now creates a brand-new company + admin user (via the same
 * companyProvisioningService.onboardCompany the "Sign up with Google"
 * button hits — see oauthController.googleCallback / GET
 * /auth/google/signup), but ONLY when the caller explicitly passes
 * `allowSelfServeSignup: true` — i.e. only when the user actually clicked
 * "Sign up with Google", never plain "Sign in with Google" (that route
 * omits the flag, so an existing-account-not-found there still refuses
 * with a clear message exactly as before — someone mistakenly hitting
 * "sign in" instead of "sign up" should not accidentally spin up a
 * second, orphaned tenant for themselves).
 */
const User = require('../models/User');
const companyProvisioningService = require('./companyProvisioningService');

/**
 * @param {'google'|'microsoft'} provider
 * @param {object} profile - the passport strategy's verified profile
 *   (for passport-google-oauth20: { id, emails: [{value, verified}], displayName, ... })
 * @param {Object} [opts]
 * @param {Boolean} [opts.allowSelfServeSignup] - true only for the
 *   "Sign up with Google" entry point; see file doc comment above.
 * @returns {Promise<import('../models/User')>}
 */
async function findOrLinkUser(provider, profile, opts = {}) {
  const { allowSelfServeSignup = false } = opts;
  const providerId = profile?.id;
  if (!providerId) throw new Error('OAuth provider did not return an account id.');

  // Case 1: already linked.
  const linked = await User.findOne({ oauthProviders: { $elemMatch: { provider, providerId } } });
  if (linked) return linked;

  const primaryEmail = (profile.emails && profile.emails[0]) || null;
  const email = primaryEmail?.value ? String(primaryEmail.value).toLowerCase() : null;
  // passport-google-oauth20 sets `verified` (boolean, sometimes the string
  // 'true' depending on API version) on each entry in profile.emails —
  // Google's own assertion that it confirmed the mailbox, not something
  // we're inferring.
  const emailVerified = primaryEmail?.verified === true || primaryEmail?.verified === 'true';

  if (!email) {
    throw new Error('Your Google account did not provide an email address, so we cannot match it to a user. Contact your company admin.');
  }

  // Case 2: auto-link to an existing local account — only with a
  // provider-verified email, and only within users that already exist
  // (never crosses into creating or discovering a different tenant).
  const existing = await User.findOne({ email });
  if (existing) {
    if (!emailVerified) {
      throw new Error('Your Google account email address is not verified with Google, so it cannot be automatically linked to an existing account. Contact your company admin.');
    }
    const alreadyHasThisProvider = (existing.oauthProviders || []).some((p) => p.provider === provider && p.providerId === providerId);
    let changed = false;
    if (!alreadyHasThisProvider) {
      existing.oauthProviders = existing.oauthProviders || [];
      existing.oauthProviders.push({ provider, providerId, email });
      changed = true;
    }
    // Linking only ever happens with a provider-verified email (see the
    // check above), so this is just as strong a proof of mailbox ownership
    // as our own OTP flow — a local account that was still sitting
    // unverified (e.g. signed up but never finished emailVerificationService's
    // code step) is now considered verified too, rather than staying stuck
    // behind a local-login gate it can no longer even reach the OTP for.
    if (!existing.emailVerified) {
      existing.emailVerified = true;
      changed = true;
    }
    if (changed) await existing.save();
    return existing;
  }

  // Case 3: nobody to link to.
  if (!allowSelfServeSignup) {
    const err = new Error('No account found for this email — contact your company admin to be added as a user, or use "Sign up with Google" to create a new business account.');
    err.statusCode = 404;
    throw err;
  }

  // Genuinely new business signing up via Google — mirrors what
  // POST /auth/register does for a password-based signup, minus the
  // password: Google already proved this mailbox is real, so the new
  // admin user goes straight to emailVerified: true with no local
  // password set (oauthProviders only — see User.passwordHash's
  // conditional `required`).
  const { admin } = await companyProvisioningService.onboardCompany({
    name: `${profile.displayName || email.split('@')[0]}'s Business`,
    adminName: profile.displayName || email.split('@')[0],
    adminEmail: email,
    oauthProvider: { provider, providerId },
  });
  return admin;
}

module.exports = { findOrLinkUser };
