const User = require('../models/User');
const Role = require('../models/Role');
const refreshTokenService = require('../services/refreshTokenService');
const { nanoid } = require('nanoid');

/** Tenant-scoped staff management — a company owner adding/managing their own users, distinct from PlatformAdmin's cross-company moderation. */
async function list(req, res) {
  const users = await User.find({ companyId: req.companyId }).select('-passwordHash').populate('roleId', 'name');
  res.json(users);
}

async function create(req, res) {
  try {
    const { name, email, password, branchId, roleId } = req.body;
    if (!name || !email || !password) throw new Error('name, email, and password are required.');

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) throw new Error(`A user with email ${email} already exists.`);

    if (roleId) {
      const role = await Role.findOne({ _id: roleId, companyId: req.companyId });
      if (!role) throw new Error('Role not found for this company.');
    }

    const user = new User({ companyId: req.companyId, branchId, roleId, name, email: email.toLowerCase() });
    await user.setPassword(password);
    await user.save();

    const { passwordHash, ...safe } = user.toObject();
    res.status(201).json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function setActive(req, res) {
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { isActive: req.body.isActive },
    { new: true }
  ).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (req.body.isActive === false) {
    await refreshTokenService.revokeAllForSubject('user', user._id); // suspending should take effect immediately, not after their current token happens to expire
  }

  res.json(user);
}

async function assignRole(req, res) {
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { roleId: req.body.roleId || null },
    { new: true }
  ).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'User not found.' });
  res.json(user);
}

/** A staff member locked out gets a new password from an owner/manager, in-app — no email-based reset flow, this is the equivalent. Also revokes their refresh tokens, forcing re-login on every device. */
async function resetPassword(req, res) {
  const user = await User.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const generatedPassword = nanoid(12);
  await user.setPassword(generatedPassword);
  await user.save();
  await refreshTokenService.revokeAllForSubject('user', user._id);

  res.json({ generatedPassword });
}

module.exports = { list, create, setActive, assignRole, resetPassword };
