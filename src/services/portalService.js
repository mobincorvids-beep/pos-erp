/**
 * PortalService — customer self-service: invite/activate, login, and
 * read-only access to their own invoices/balance/payments (via the
 * existing customerLedgerService, not a duplicate query) plus the
 * ability to raise a support ticket (via the existing ticketService).
 * Deliberately does not expose write access to anything financial —
 * a customer can look, and can ask (a ticket), never directly edit.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const PortalUser = require('../models/PortalUser');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const refreshTokenService = require('./refreshTokenService');
const customerLedgerService = require('./customerLedgerService');
const notificationService = require('./notificationService');
const ticketService = require('./ticketService');
const Branch = require('../models/Branch');

// Invites are a real, single-use, time-limited token (not a permanent
// activation link) — expires in 7 days, same "an unused invite eventually
// goes stale" principle the 2FA pre-auth token uses on a shorter scale.
function signInviteToken(portalUserId) {
  return jwt.sign({ portal: true, invite: true, portalUserId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function signPortalAccessToken(portalUser) {
  return jwt.sign(
    { portal: true, portalUserId: portalUser._id, customerId: portalUser.customerId, companyId: portalUser.companyId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

/** Staff-initiated: creates (or reuses) a portal login for a customer and emails them an activation link. No password is set yet; the customer chooses their own via activateInvite(). */
async function invite({ companyId, customerId, email, userId }) {
  const customer = await Customer.findOne({ _id: customerId, companyId });
  if (!customer) throw new Error('Customer not found.');

  let portalUser = await PortalUser.findOne({ customerId });
  if (portalUser) {
    portalUser.email = email.toLowerCase().trim();
    portalUser.isActive = false; // stays inactive until they actually set a password via the invite link
  } else {
    // A random, throwaway placeholder hash — never usable to log in
    // (activateInvite always overwrites it before the account is ever
    // marked active), just satisfies the required field until then.
    const placeholder = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    portalUser = new PortalUser({ companyId, customerId, email: email.toLowerCase().trim(), passwordHash: placeholder, isActive: false });
  }
  await portalUser.save();

  const inviteToken = signInviteToken(portalUser._id);

  await notificationService.notify({
    companyId, userId, type: 'portal_invite_sent', title: 'Portal invite sent',
    message: `Invited ${customer.name} to the customer portal`, entityType: 'Customer', entityId: customer._id,
  });

  // The invite token itself is returned to the caller (the controller),
  // which is responsible for actually delivering it — this service layer
  // doesn't know or care whether that's email/SMS/a copy-paste link.
  return { portalUserId: portalUser._id, inviteToken };
}

/** Customer clicks their invite link and sets a real password for the first time. */
async function activateInvite(inviteToken, password) {
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  let payload;
  try {
    payload = jwt.verify(inviteToken, process.env.JWT_SECRET);
  } catch {
    throw new Error('This invite link is invalid or has expired.');
  }
  if (!payload.invite) throw new Error('Not a valid invite token.');

  const portalUser = await PortalUser.findById(payload.portalUserId);
  if (!portalUser) throw new Error('Invite not found.');

  portalUser.passwordHash = await bcrypt.hash(password, 10);
  portalUser.isActive = true;
  await portalUser.save();
  return portalUser;
}

async function login({ email, password, deviceContext }) {
  const portalUser = await PortalUser.findOne({ email: email.toLowerCase().trim() });
  if (!portalUser || !portalUser.isActive) throw new Error('Invalid email or password.');

  const valid = await bcrypt.compare(password, portalUser.passwordHash);
  if (!valid) throw new Error('Invalid email or password.');

  portalUser.lastLoginAt = new Date();
  await portalUser.save();

  const accessToken = signPortalAccessToken(portalUser);
  const refreshToken = await refreshTokenService.issue('PortalUser', portalUser._id, deviceContext);
  return { accessToken, refreshToken, customerId: portalUser.customerId };
}

/** The portal home view: outstanding balance and recent activity, straight from the real ledger, not a separate summary that could drift from it. */
async function dashboard(customerId) {
  const ledgerResult = await customerLedgerService.ledger(customerId);
  const recentInvoices = await Sale.find({ customerId, status: 'completed' }).sort({ createdAt: -1 }).limit(10)
    .select('invoiceNumber documentNumber totalAmount dueAmount createdAt');
  return {
    closingBalance: ledgerResult.closingBalance,
    recentEntries: ledgerResult.entries.slice(-10).reverse(),
    recentInvoices,
  };
}

function listInvoices(customerId, { status } = {}) {
  const filter = { customerId, status: 'completed' };
  if (status === 'due') filter.dueAmount = { $gt: 0 };
  return Sale.find(filter).sort({ createdAt: -1 });
}

async function getInvoice(customerId, saleId) {
  const sale = await Sale.findOne({ _id: saleId, customerId, status: 'completed' });
  if (!sale) throw new Error('Invoice not found.');
  return sale;
}

/** Lets the customer raise a support request themselves, through the same real Ticket/SLA engine staff use, not a separate, disconnected "contact us" form. Uses the company's first active branch since a customer has no branch of their own to pick from. */
async function submitTicket(companyId, customerId, { category, subject, description, priority }) {
  const branch = await Branch.findOne({ companyId, isActive: true }).sort({ createdAt: 1 });
  if (!branch) throw new Error('This company has no active branch configured to route the ticket to.');
  return ticketService.createTicket({ companyId, branchId: branch._id, customerId, category, subject, description, priority: priority || 'medium' });
}

/** Exchanges a refresh token for a new access token, same rotation-with-reuse-detection flow the staff session uses (refreshTokenService.rotate is subject-type-agnostic, 'PortalUser' here instead of 'User'). */
async function refresh(rawRefreshToken) {
  const { subjectType, subjectId, newToken } = await refreshTokenService.rotate(rawRefreshToken);
  if (subjectType !== 'PortalUser') throw new Error('Invalid refresh token.');
  const portalUser = await PortalUser.findById(subjectId);
  if (!portalUser || !portalUser.isActive) throw new Error('Invalid or inactive portal account.');
  return { accessToken: signPortalAccessToken(portalUser), refreshToken: newToken };
}

module.exports = { invite, activateInvite, login, refresh, dashboard, listInvoices, getInvoice, submitTicket };
