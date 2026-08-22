const { Schema, model } = require('mongoose');

// Every login ATTEMPT — success or failure — genuinely different from
// RefreshToken (which only exists for SUCCESSFUL logins that get a real
// session). A failed login never creates a session at all, but it's
// exactly the thing "login history" and "security alerts" both need to
// exist regardless of outcome, so this is a separate, purpose-built record.
const loginAttemptSchema = new Schema({
  email: { type: String, required: true, lowercase: true, index: true }, // kept even on failure, so a string of failed attempts against one email is genuinely detectable
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null }, // only set if the email actually matched a real user
  companyId: { type: Schema.Types.ObjectId, ref: 'Company', default: null },
  success: { type: Boolean, required: true },
  failureReason: { type: String, default: null }, // 'invalid_credentials', 'account_disabled', 'invalid_2fa_code'...
  ipAddress: { type: String, default: null },
  userAgent: { type: String, default: null },
}, { timestamps: true });

loginAttemptSchema.index({ email: 1, createdAt: -1 });

module.exports = model('LoginAttempt', loginAttemptSchema);
