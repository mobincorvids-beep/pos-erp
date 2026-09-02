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
 * Self-serve tenant creation via OAuth is explicitly NOT supported here:
 * a brand-new person with no existing account gets a clear message to
 * contact their company admin, never a silently-created orphaned
 * company. (Self-serve signup for a genuinely new business still exists
 * via POST /auth/register, which is unrelated to this file.)
 */
const User = require('../models/User');

/**
 * @param {'google'|'microsoft'} provider
 * @param {object} profile - the passport strategy's verified profile
 *   (for passport-google-oauth20: { id, emails: [{value, verified}], displayName, ... })
 * @returns {Promise<import('../models/User')>}
 */
async function findOrLinkUser(provider, profile) {
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
    if (!alreadyHasThisProvider) {
      existing.oauthProviders = existing.oauthProviders || [];
      existing.oauthProviders.push({ provider, providerId, email });
      await existing.save();
    }
    return existing;
  }

  // Case 3: nobody to link to — refuse rather than orphan-create.
  const err = new Error('No account found for this email — contact your company admin to be added as a user. Self-serve company creation via Google sign-in is not yet supported.');
  err.statusCode = 404;
  throw err;
}

module.exports = { findOrLinkUser };
