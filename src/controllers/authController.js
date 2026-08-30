const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Company = require('../models/Company');
const refreshTokenService = require('../services/refreshTokenService');
const twoFactorService = require('../services/twoFactorService');
const securityService = require('../services/securityService');
const companyProvisioningService = require('../services/companyProvisioningService');

function deviceContext(req) {
  return { ipAddress: req.ip, userAgent: req.get('User-Agent') || null };
}

function signAccessToken(user) {
  return jwt.sign(
    { userId: user._id, companyId: user.companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' } // short-lived on purpose — refreshToken covers the rest of the session
  );
}

// A separate, distinctly-scoped, SHORT-lived token issued only mid-2FA —
// this can NEVER be used to call a real API route (requireAuth looks for
// a normal access token's shape, not this one), it exists purely to prove
// "this specific person already correctly entered their password" across
// the two-request 2FA flow without re-asking for it, and expires in 5
// minutes so an abandoned login attempt can't be resumed hours later.
function signPreAuthToken(user) {
  return jwt.sign({ userId: user._id, pending2FA: true }, process.env.JWT_SECRET, { expiresIn: '5m' });
}

async function login(req, res) {
  const { email, password } = req.body;
  const ctx = deviceContext(req);
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user || !(await user.checkPassword(password))) {
    // Recorded regardless of WHY it failed — including when the email
    // doesn't match any real user at all, since a real login history has
    // to reflect every genuine attempt, not just the ones against
    // accounts that happen to exist.
    await securityService.recordAttempt({ email, userId: user?._id || null, companyId: user?.companyId || null, success: false, failureReason: 'invalid_credentials', ...ctx });
    if (user) await securityService.checkFailedLoginAlert(email, user._id, user.companyId);
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (!user.isActive) {
    await securityService.recordAttempt({ email, userId: user._id, companyId: user.companyId, success: false, failureReason: 'account_disabled', ...ctx });
    return res.status(403).json({ error: 'This account is disabled.' });
  }

  // Genuinely unchanged for every user without 2FA enabled — the default,
  // and the only path that existed at all before this feature — so
  // nothing that worked before this round behaves any differently now.
  if (!user.twoFactorEnabled) {
    await securityService.recordAttempt({ email, userId: user._id, companyId: user.companyId, success: true, ...ctx });
    const token = signAccessToken(user);
    const refreshToken = await refreshTokenService.issue('user', user._id, ctx);
    return res.json({
      token, refreshToken,
      user: { id: user._id, name: user.name, email: user.email, companyId: user.companyId, branchId: user.branchId, twoFactorEnabled: user.twoFactorEnabled },
    });
  }

  // 2FA enabled — password was correct, but the real tokens are withheld
  // (and the login isn't recorded as a genuine SUCCESS yet either — that
  // only happens once the second factor also checks out, in
  // verifyTwoFactor() below) until the second factor is also verified.
  res.json({ requires2FA: true, preAuthToken: signPreAuthToken(user) });
}

/**
 * Public self-serve signup — a NEW business creates its own tenant.
 * Reuses the same onboardCompany() the platform-admin "add company" flow
 * uses (Company + Main Branch/Warehouse/Terminal + starter chart of
 * accounts + one admin user), so a self-signed-up business ends up in
 * exactly the same, fully-isolated shape as an admin-provisioned one —
 * scoped to its own companyId everywhere, invisible to every other
 * tenant. The only difference from the admin flow: this is reachable
 * without a login, and it logs the new admin straight in afterwards
 * instead of returning a generated password to hand over separately.
 */
async function register(req, res) {
  try {
    const { businessName, industryType, currency, adminName, adminEmail, adminPassword } = req.body;
    const { company, admin } = await companyProvisioningService.onboardCompany({
      name: businessName,
      industryType,
      currency,
      adminName,
      adminEmail,
      adminPassword,
    });

    const ctx = deviceContext(req);
    await securityService.recordAttempt({ email: admin.email, userId: admin._id, companyId: admin.companyId, success: true, ...ctx });
    const token = signAccessToken(admin);
    const refreshToken = await refreshTokenService.issue('user', admin._id, ctx);
    res.status(201).json({
      token, refreshToken,
      user: { id: admin._id, name: admin.name, email: admin.email, companyId: admin.companyId, branchId: admin.branchId, twoFactorEnabled: false },
      company: { id: company._id, name: company.name, industryType: company.industryType, currency: company.currency },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** The second step of a 2FA login, exchanges a valid preAuthToken + a real TOTP/backup code for the actual session tokens. */
async function verifyTwoFactor(req, res) {
  try {
    const { preAuthToken, token } = req.body;
    const ctx = deviceContext(req);
    if (!preAuthToken || !token) return res.status(400).json({ error: 'preAuthToken and token are required.' });

    let decoded;
    try {
      decoded = jwt.verify(preAuthToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'This 2FA session has expired, please log in again.' });
    }
    if (!decoded.pending2FA) return res.status(401).json({ error: 'Invalid pre-authentication token.' });

    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const result = await twoFactorService.verifyLoginCode(decoded.userId, token);
    if (!result.verified) {
      await securityService.recordAttempt({ email: user.email, userId: user._id, companyId: user.companyId, success: false, failureReason: 'invalid_2fa_code', ...ctx });
      await securityService.checkFailedLoginAlert(user.email, user._id, user.companyId);
      return res.status(401).json({ error: 'Invalid verification code.' });
    }
    if (!user.isActive) return res.status(403).json({ error: 'This account is disabled.' });

    await securityService.recordAttempt({ email: user.email, userId: user._id, companyId: user.companyId, success: true, ...ctx });
    const accessToken = signAccessToken(user);
    const refreshToken = await refreshTokenService.issue('user', user._id, ctx);
    res.json({
      token: accessToken, refreshToken,
      user: { id: user._id, name: user.name, email: user.email, companyId: user.companyId, branchId: user.branchId, twoFactorEnabled: user.twoFactorEnabled },
      usedBackupCode: result.usedBackupCode, remainingBackupCodes: result.remainingBackupCodes,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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

/** Restores session on page reload, req.auth is already populated by requireAuth. */
async function me(req, res) {
  const user = await User.findById(req.auth.userId);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const company = await Company.findById(user.companyId);

  res.json({
    user: { id: user._id, name: user.name, email: user.email, companyId: user.companyId, branchId: user.branchId, twoFactorEnabled: user.twoFactorEnabled },
    permissions: req.auth.permissions, // null = super-admin
    company: company ? { id: company._id, name: company.name, industryType: company.industryType, currency: company.currency, activeModules: company.activeModules } : null,
  });
}

module.exports = { login, register, verifyTwoFactor, refresh, logout, me, setupTwoFactor, confirmTwoFactor, disableTwoFactor, listSessions, revokeSession, listLoginHistory };

async function setupTwoFactor(req, res) {
  try { res.json(await twoFactorService.setup(req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function confirmTwoFactor(req, res) {
  try { res.json(await twoFactorService.confirmSetup(req.auth.userId, req.body.token)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function disableTwoFactor(req, res) {
  try { res.json(await twoFactorService.disable(req.auth.userId, req.body.password)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

/** A real "which devices am I logged in on" list: the actual live RefreshToken records for this user, with device/IP context, never the token hash itself. */
async function listSessions(req, res) {
  res.json(await refreshTokenService.listActiveSessions('user', req.auth.userId));
}
/** Signs out ONE specific device remotely, checked to genuinely belong to the requesting user first. */
async function revokeSession(req, res) {
  try { res.json(await refreshTokenService.revokeById(req.params.id, 'user', req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listLoginHistory(req, res) {
  res.json(await securityService.listLoginHistory(req.auth.userId, req.query));
}
