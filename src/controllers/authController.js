const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const Company = require('../models/Company');
const refreshTokenService = require('../services/refreshTokenService');
const companyProvisioningService = require('../services/companyProvisioningService');
const messagingService = require('../services/messaging/messagingService');

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PASSWORD_RESET_MINUTES = 60;

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id, companyId: user.companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' } // short-lived on purpose — refreshToken covers the rest of the session
  );
}

/** Hashed the same way refresh tokens are — a DB leak alone shouldn't let anyone reset a password. */
function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function login(req, res) {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return res.status(403).json({ error: 'Account temporarily locked, try again later.' });
  }

  if (!(await user.checkPassword(password))) {
    // Track consecutive failures and lock the account once the threshold is
    // hit — reset the counter at that point so lockedUntil is what gates
    // the next attempt, not an ever-growing counter.
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
      user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'This account is disabled.' });
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  const token = signAccessToken(user);
  const refreshToken = await refreshTokenService.issue('user', user._id);

  res.json({
    token, refreshToken,
    user: { id: user._id, name: user.name, email: user.email, companyId: user.companyId, branchId: user.branchId },
  });
}

/** Self-service signup — onboards a brand new company + its first admin user. Reuses companyProvisioningService so onboarding logic lives in exactly one place. */
async function register(req, res) {
  const { companyName, industryType, adminName, adminEmail, adminPassword } = req.body;

  const existingUser = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingUser) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  let result;
  try {
    result = await companyProvisioningService.onboardCompany({
      name: companyName, industryType, adminName, adminEmail, adminPassword,
    });
  } catch (err) {
    // onboardCompany throws plain Errors for its own validation (e.g. the
    // same email-exists race) — surface those as 409s rather than 500s.
    return res.status(409).json({ error: err.message });
  }

  const { company, admin } = result;
  const token = signAccessToken(admin);
  const refreshToken = await refreshTokenService.issue('user', admin._id);

  res.status(201).json({
    token, refreshToken,
    user: { id: admin._id, name: admin.name, email: admin.email, companyId: admin.companyId, branchId: admin.branchId },
    company: { id: company._id, name: company.name, industryType: company.industryType },
  });
}

/** Always responds the same way regardless of whether the email exists, so this endpoint can't be used to enumerate accounts. */
async function forgotPassword(req, res) {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  if (user) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetTokenHash = hashResetToken(rawToken);
    user.passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_MINUTES * 60 * 1000);
    await user.save();

    const clientOrigin = (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim();
    const resetLink = `${clientOrigin}/reset-password?token=${rawToken}`;
    await messagingService.sendEmail(
      user.email,
      'Reset your password',
      `We received a request to reset your password. This link expires in ${PASSWORD_RESET_MINUTES} minutes:\n\n${resetLink}\n\nIf you didn't request this, you can safely ignore this email.`
    );
  }

  res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
}

async function resetPassword(req, res) {
  const { token, newPassword } = req.body;
  const user = await User.findOne({ passwordResetTokenHash: hashResetToken(token) });

  if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
    return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
  }

  await user.setPassword(newPassword);
  user.passwordResetTokenHash = null;
  user.passwordResetExpires = null;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  await user.save();

  // Force re-login everywhere — a password reset is a strong signal that
  // old session material shouldn't be trusted anymore.
  await refreshTokenService.revokeAllForSubject('user', user._id);

  res.json({ ok: true });
}

/** Exchanges a valid refresh token for a new access token, rotating the refresh token in the same call (single-use). */
async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required.' });

    const { subjectType, subjectId, newToken } = await refreshTokenService.rotate(refreshToken);
    if (subjectType !== 'user') return res.status(401).json({ error: 'Invalid refresh token.' });

    const user = await User.findById(subjectId);
    if (!user || !user.isActive) return res.status(401).json({ error: 'Account no longer active.' });

    res.json({ token: signAccessToken(user), refreshToken: newToken });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) await refreshTokenService.revoke(refreshToken);
  res.json({ ok: true });
}

/** Restores session on page reload — req.auth is already populated by requireAuth. */
async function me(req, res) {
  const user = await User.findById(req.auth.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const company = await Company.findById(user.companyId);

  res.json({
    user: { id: user._id, name: user.name, email: user.email, companyId: user.companyId, branchId: user.branchId },
    permissions: req.auth.permissions, // null = super-admin
    company: company ? { id: company._id, name: company.name, industryType: company.industryType, currency: company.currency, activeModules: company.activeModules } : null,
  });
}

module.exports = { login, register, forgotPassword, resetPassword, refresh, logout, me };
