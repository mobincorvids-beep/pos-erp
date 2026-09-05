const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role' },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  // Required for local (email/password) accounts. NOT required for a user
  // provisioned/linked purely via OAuth (oauthProviders non-empty) who has
  // never set a local password — they can only sign in through their
  // linked provider(s) until/unless a local password is set for them.
  // checkPassword() below treats a null passwordHash as "no local
  // password" rather than bcrypt-comparing against it.
  passwordHash: {
    type: String,
    default: null,
    required: function () { return !(this.oauthProviders && this.oauthProviders.length > 0); },
  },
  isActive: { type: Boolean, default: true },

  // SSO/OAuth identities linked to this account. A user can have zero
  // (pure local), one, or more (e.g. Google AND Microsoft) linked
  // providers. See src/services/oauthService.js for how linking happens
  // (find-or-link by providerId, or auto-link to an existing local
  // account by verified email) and src/config/passport.js for how each
  // provider's strategy is registered only when its env vars are set.
  oauthProviders: {
    type: [{
      provider: { type: String, enum: ['google', 'microsoft'], required: true },
      providerId: { type: String, required: true },
      email: String,
    }],
    default: [],
  },

  // 2FA (TOTP) — twoFactorSecret is set the moment setup() is called but
  // twoFactorEnabled stays false until the user actually proves they can
  // generate a valid code (confirmSetup()), so a half-finished setup
  // never silently locks anyone out or is silently treated as active.
  // Backup codes are stored HASHED, never plain — same principle as
  // passwordHash, and checked the same way (bcrypt.compare), never by
  // direct string equality.
  twoFactorSecret: { type: String, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorBackupCodeHashes: { type: [String], default: [] },

  // Email ownership verification — separate from 2FA above (2FA proves
  // "you have this authenticator device on every login"; this proves
  // "you actually own this mailbox", once, at signup). A brand-new local
  // (email/password) signup starts with emailVerified: false and cannot
  // log in (see authController.login) until they submit the 6-digit code
  // emailVerificationService mails them. A user created via Google OAuth
  // is marked verified immediately — Google has already proven mailbox
  // ownership, asking them to re-prove it would be redundant. The code
  // itself is NEVER stored in plaintext (hashed with bcrypt, same
  // principle as passwordHash/twoFactorBackupCodeHashes) and expires
  // quickly (emailVerificationService.OTP_TTL_MINUTES).
  emailVerified: { type: Boolean, default: false },
  emailOtpHash: { type: String, default: null },
  emailOtpExpiresAt: { type: Date, default: null },
  // Throttles resend-code abuse independently of the shared authLimiter
  // (which is per-IP) — this is per-ACCOUNT, so someone can't be spammed
  // with verification emails from many IPs, and a legitimate user who
  // fat-fingers "resend" repeatedly still can't flood their own inbox.
  emailOtpLastSentAt: { type: Date, default: null },
}, { timestamps: true });

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.checkPassword = function (plain) {
  // A pure-OAuth account (never set a local password) has no hash to
  // compare against — treat that as "wrong password" rather than letting
  // bcrypt.compare(plain, null) throw, so local-login stays a clean
  // reject instead of a 500 for these accounts.
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = model('User', userSchema);
