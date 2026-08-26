const portalService = require('../services/portalService');

// --- Staff-side (uses normal staff auth — inviting a customer to the portal) ---
async function invite(req, res) {
  try {
    const result = await portalService.invite({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    // In production this token would be emailed; returned directly here
    // since this app has no outbound-email provider wired for this yet
    // (see messagingService for the SMS/console providers that DO exist —
    // email invites are a real follow-up, not something to fake silently).
    res.status(201).json({ portalUserId: result.portalUserId, inviteToken: result.inviteToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Portal-side (customer's own session) ---
function deviceContext(req) {
  return { ipAddress: req.ip, userAgent: req.get('User-Agent') || null };
}

async function activateInvite(req, res) {
  try {
    await portalService.activateInvite(req.body.inviteToken, req.body.password);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function login(req, res) {
  try {
    const result = await portalService.login({ email: req.body.email, password: req.body.password, deviceContext: deviceContext(req) });
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
}

async function refresh(req, res) {
  try { res.json(await portalService.refresh(req.body.refreshToken)); }
  catch (err) { res.status(401).json({ error: err.message }); }
}

async function dashboard(req, res) {
  res.json(await portalService.dashboard(req.portalAuth.customerId));
}

async function listInvoices(req, res) {
  res.json(await portalService.listInvoices(req.portalAuth.customerId, req.query));
}

async function getInvoice(req, res) {
  try { res.json(await portalService.getInvoice(req.portalAuth.customerId, req.params.saleId)); }
  catch (err) { res.status(404).json({ error: err.message }); }
}

async function submitTicket(req, res) {
  try { res.status(201).json(await portalService.submitTicket(req.portalAuth.companyId, req.portalAuth.customerId, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { invite, activateInvite, login, refresh, dashboard, listInvoices, getInvoice, submitTicket };
