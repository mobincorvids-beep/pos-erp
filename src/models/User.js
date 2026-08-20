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

  // Account lockout after repeated failed logins — see authController.login.
  // Reset on every successful login; lockedUntil is only set once
  // failedLoginAttempts hits the threshold.
  failedLoginAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date, default: null },

  // Password reset — token is hashed at rest (same rationale as
  // RefreshToken.tokenHash: a database leak alone shouldn't let anyone
  // reset a password). Kept as inline fields rather than a separate
  // model since, unlike refresh tokens, a user only ever has one live
  // reset request at a time — no need for a collection of them.
  passwordResetTokenHash: { type: String, default: null },
  passwordResetExpires: { type: Date, default: null },
}, { timestamps: true });

userSchema.methods.setPassword = async function (plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.checkPassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

module.exports = model('User', userSchema);
