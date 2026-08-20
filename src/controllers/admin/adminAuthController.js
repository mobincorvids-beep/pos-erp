const jwt = require('jsonwebtoken');
const PlatformAdmin = require('../../models/PlatformAdmin');
const refreshTokenService = require('../../services/refreshTokenService');
const auditService = require('../../services/auditService');
const { nanoid } = require('nanoid');

function signAccessToken(admin) {
  return jwt.sign(
    { adminId: admin._id, type: 'platform_admin' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

async function login(req, res) {
  const { email, password } = req.body;
  const admin = await PlatformAdmin.findOne({ email: email.toLowerCase() });
  if (!admin || !(await admin.checkPassword(password))) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  if (!admin.isActive) return res.status(403).json({ error: 'This admin account is disabled.' });

  const token = signAccessToken(admin);
  const refreshToken = await refreshTokenService.issue('platform_admin', admin._id);

  res.json({ token, refreshToken, admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
}

async function refresh(req, res) {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required.' });

    const { subjectType, subjectId, newToken } = await refreshTokenService.rotate(refreshToken);
    if (subjectType !== 'platform_admin') return res.status(401).json({ error: 'Invalid refresh token.' });

    const admin = await PlatformAdmin.findById(subjectId);
    if (!admin || !admin.isActive) return res.status(401).json({ error: 'Account no longer active.' });

    res.json({ token: signAccessToken(admin), refreshToken: newToken });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) await refreshTokenService.revoke(refreshToken);
  res.json({ ok: true });
}

async function me(req, res) {
  const admin = await PlatformAdmin.findById(req.platformAdmin.adminId);
  if (!admin) return res.status(404).json({ error: 'Admin not found.' });
  res.json({ admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } });
}

/**
 * An existing admin (role 'admin', not 'support' — see requireAdminRole)
 * creates another platform admin. Closes the bootstrap gap where only
 * `npm run seed:admin` could ever create the first one — now an admin
 * created that way can create every admin after it entirely in-app.
 */
async function createAdmin(req, res) {
  try {
    const { name, email, role } = req.body;
    if (!name || !email) throw new Error('name and email are required.');

    const existing = await PlatformAdmin.findOne({ email: email.toLowerCase() });
    if (existing) throw new Error(`An admin with email ${email} already exists.`);

    const generatedPassword = nanoid(12);
    const admin = new PlatformAdmin({ name, email: email.toLowerCase(), role: role === 'support' ? 'support' : 'admin' });
    await admin.setPassword(generatedPassword);
    await admin.save();

    await auditService.record({
      companyId: null, userId: null, action: 'platform_admin.created',
      entityType: 'PlatformAdmin', entityId: admin._id,
      metadata: { createdByAdminId: req.platformAdmin.adminId },
    });

    // Shown once, same principle as the tenant-onboarding password.
    res.status(201).json({ admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }, generatedPassword });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** An admin resets another platform admin's password (e.g. they're locked out) — no email-based reset flow exists yet, so this is the in-app equivalent. */
async function resetPassword(req, res) {
  try {
    const target = await PlatformAdmin.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Admin not found.' });

    const generatedPassword = nanoid(12);
    await target.setPassword(generatedPassword);
    await target.save();
    await refreshTokenService.revokeAllForSubject('platform_admin', target._id); // force re-login everywhere

    await auditService.record({
      companyId: null, userId: null, action: 'platform_admin.password_reset',
      entityType: 'PlatformAdmin', entityId: target._id,
      metadata: { resetByAdminId: req.platformAdmin.adminId },
    });

    res.json({ generatedPassword });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { login, refresh, logout, me, createAdmin, resetPassword };
