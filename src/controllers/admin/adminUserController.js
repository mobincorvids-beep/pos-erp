const User = require('../../models/User');
const auditService = require('../../services/auditService');
const refreshTokenService = require('../../services/refreshTokenService');

async function list(req, res) {
  const filter = {};
  if (req.query.companyId) filter.companyId = req.query.companyId;
  if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === 'true';

  const users = await User.find(filter)
    .select('-passwordHash')
    .populate('companyId', 'name')
    .sort({ createdAt: -1 })
    .limit(200);
  res.json(users);
}

/** Platform-level moderation — suspending a user across the whole platform. Distinct from a company owner deactivating their own staff via /users (tenant-scoped, permission-gated by USERS_MANAGE) — this is the cross-company override for the platform operator. */
async function setActive(req, res) {
  const { isActive } = req.body;
  const user = await User.findByIdAndUpdate(req.params.id, { isActive }, { new: true }).select('-passwordHash');
  if (!user) return res.status(404).json({ error: 'User not found.' });

  if (isActive === false) {
    await refreshTokenService.revokeAllForSubject('user', user._id);
  }

  await auditService.record({
    companyId: user.companyId, userId: null, action: isActive ? 'user.activated_by_platform' : 'user.suspended_by_platform',
    entityType: 'User', entityId: user._id, metadata: { byAdminId: req.platformAdmin.adminId },
  });
  res.json(user);
}

module.exports = { list, setActive };
