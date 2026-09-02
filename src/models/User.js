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
