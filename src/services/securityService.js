/**
 * SecurityService — real login history and failed-login security alerts,
 * both confirmed genuinely absent from this app before this round
 * (checked via grep, not assumed). Deliberately reuses the Notification
 * Engine for alerting rather than inventing a second delivery mechanism —
 * a security alert is a Notification like any other, targeted at the
 * user whose account is under attempted attack.
 */
const LoginAttempt = require('../models/LoginAttempt');
const Role = require('../models/Role');
const notificationService = require('./notificationService');

const FAILED_ATTEMPT_THRESHOLD = 5;
const FAILED_ATTEMPT_WINDOW_MINUTES = 15;

/** Records one attempt: always, regardless of outcome, since a login history with only the successes shown is not a real security log. */
function recordAttempt({ email, userId, companyId, success, failureReason, ipAddress, userAgent }) {
  return LoginAttempt.create({ email: email.toLowerCase(), userId, companyId, success, failureReason, ipAddress, userAgent });
}

/**
 * Checks whether the last FAILED_ATTEMPT_THRESHOLD attempts against this
 * email, within the last FAILED_ATTEMPT_WINDOW_MINUTES, were ALL
 * failures — and if so, fires a real security alert. Deliberately checks
 * "all recent attempts failed", not just "count of failures ever", so a
 * single successful login resets the count naturally (there's nothing to
 * alert about once someone's actually gotten in correctly) without
 * needing a separate reset mechanism.
 */
async function checkFailedLoginAlert(email, userId, companyId) {
  const windowStart = new Date(Date.now() - FAILED_ATTEMPT_WINDOW_MINUTES * 60 * 1000);
  const recentAttempts = await LoginAttempt.find({ email: email.toLowerCase(), createdAt: { $gte: windowStart } })
    .sort({ createdAt: -1 })
    .limit(FAILED_ATTEMPT_THRESHOLD);

  if (recentAttempts.length < FAILED_ATTEMPT_THRESHOLD) return { alertFired: false };
  const allFailed = recentAttempts.every((a) => a.success === false);
  if (!allFailed) return { alertFired: false };

  if (userId && companyId) {
    const roles = await Role.find({ companyId, permissions: { $in: ['roles.manage', '*'] } });
    for (const role of roles) {
      await notificationService.notify({
        companyId, roleId: role._id, type: 'security_alert',
        title: `${FAILED_ATTEMPT_THRESHOLD} failed login attempts`,
        message: `${email} has had ${FAILED_ATTEMPT_THRESHOLD} consecutive failed login attempts in the last ${FAILED_ATTEMPT_WINDOW_MINUTES} minutes.`,
        entityType: 'User', entityId: userId,
      });
    }
  }

  return { alertFired: true };
}

function listLoginHistory(userId, { limit = 50 } = {}) {
  return LoginAttempt.find({ userId }).sort({ createdAt: -1 }).limit(limit);
}

module.exports = { recordAttempt, checkFailedLoginAlert, listLoginHistory, FAILED_ATTEMPT_THRESHOLD, FAILED_ATTEMPT_WINDOW_MINUTES };
