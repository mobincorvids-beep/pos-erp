const employeePortalService = require('../services/employeePortalService');

// --- Staff-side (uses normal staff auth — inviting an employee to the portal) ---
async function invite(req, res) {
  try {
    const result = await employeePortalService.invite({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    // In production this token would be emailed; returned directly here for
    // the same reason portalController.invite does — no outbound-email
    // provider wired up for this yet.
    res.status(201).json({ employeePortalUserId: result.employeePortalUserId, inviteToken: result.inviteToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Portal-side (employee's own session) ---
function deviceContext(req) {
  return { ipAddress: req.ip, userAgent: req.get('User-Agent') || null };
}

async function activateInvite(req, res) {
  try {
    await employeePortalService.activateInvite(req.body.inviteToken, req.body.password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const result = await employeePortalService.login({ email: req.body.email, password: req.body.password, deviceContext: deviceContext(req) });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function refresh(req, res) {
  try { res.json(await employeePortalService.refresh(req.body.refreshToken)); }
  catch (err) { res.status(401).json({ error: err.message }); }
}

async function dashboard(req, res) {
  try { res.json(await employeePortalService.dashboard(req.employeePortalAuth.employeeId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function myAttendance(req, res) {
  res.json(await employeePortalService.myAttendance(req.employeePortalAuth.employeeId, req.query));
}

async function myPayslips(req, res) {
  res.json(await employeePortalService.myPayslips(req.employeePortalAuth.employeeId));
}

async function myLeaveRequests(req, res) {
  res.json(await employeePortalService.myLeaveRequests(req.employeePortalAuth.employeeId));
}

async function requestLeave(req, res) {
  try {
    res.status(201).json(await employeePortalService.requestLeave(req.employeePortalAuth.companyId, req.employeePortalAuth.employeeId, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getProfile(req, res) {
  try { res.json(await employeePortalService.getProfile(req.employeePortalAuth.employeeId)); }
  catch (err) { res.status(404).json({ error: err.message }); }
}

async function updateProfile(req, res) {
  try {
    res.json(await employeePortalService.updateProfile(req.employeePortalAuth.employeePortalUserId, req.employeePortalAuth.employeeId, req.body));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  invite, activateInvite, login, refresh, dashboard,
  myAttendance, myPayslips, myLeaveRequests, requestLeave,
  getProfile, updateProfile,
};
