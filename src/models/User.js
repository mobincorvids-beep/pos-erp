const { Schema, model } = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new Schema({
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  roleId: { type: Schema.Types.ObjectId, ref: 'Role' },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: String,
  passwordHash: { type: String, required: true },
  isActive: { type: Boolean, default: true },

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
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = model('User', userSchema);
