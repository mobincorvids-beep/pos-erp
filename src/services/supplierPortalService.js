/**
 * SupplierPortalService — mirror of portalService.js, but for suppliers:
 * invite/activate, login, and read-only self-service access to their own
 * purchase orders and payment/ledger history (via the existing
 * supplierLedgerService, not a duplicate query).
 *
 * Note on scope vs. the customer portal: portalService also lets a
 * customer raise a support ticket via ticketService.createTicket(), which
 * requires either a customerId or a raisedByUserId on the Ticket model.
 * Ticket has no supplierId field, and editing shared models (Ticket,
 * PurchaseOrder) is out of scope for this isolated build, so this service
 * deliberately does NOT expose ticket-raising or PO-acknowledgment — see
 * the accompanying report for what a follow-up would need to add.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SupplierPortalUser = require('../models/SupplierPortalUser');
const Supplier = require('../models/Supplier');
const PurchaseOrder = require('../models/PurchaseOrder');
const refreshTokenService = require('./refreshTokenService');
const supplierLedgerService = require('./supplierLedgerService');
const notificationService = require('./notificationService');

// Same "real, single-use, time-limited invite token" pattern as the
// customer portal — expires in 7 days.
function signInviteToken(supplierPortalUserId) {
  return jwt.sign({ supplierPortal: true, invite: true, supplierPortalUserId }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function signPortalAccessToken(supplierPortalUser) {
  return jwt.sign(
    {
      supplierPortal: true,
      supplierPortalUserId: supplierPortalUser._id,
      supplierId: supplierPortalUser.supplierId,
      companyId: supplierPortalUser.companyId,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
}

/** Staff-initiated: creates (or reuses) a portal login for a supplier and returns an activation link/token. No password is set yet; the supplier chooses their own via activateInvite(). */
async function invite({ companyId, supplierId, email, userId }) {
  const supplier = await Supplier.findOne({ _id: supplierId, companyId });
  if (!supplier) throw new Error('Supplier not found.');

  let portalUser = await SupplierPortalUser.findOne({ supplierId });
  if (portalUser) {
    portalUser.email = email.toLowerCase().trim();
    portalUser.isActive = false; // stays inactive until the invite is actually accepted
    portalUser.invitedAt = new Date();
  } else {
    // Random throwaway placeholder hash — never usable to log in;
    // activateInvite always overwrites it before the account goes active.
    const placeholder = await bcrypt.hash(crypto.randomBytes(24).toString('hex'), 10);
    portalUser = new SupplierPortalUser({
      companyId, supplierId, email: email.toLowerCase().trim(), passwordHash: placeholder, isActive: false, invitedAt: new Date(),
    });
  }
  await portalUser.save();

  const inviteToken = signInviteToken(portalUser._id);

  await notificationService.notify({
    companyId, userId, type: 'supplier_portal_invite_sent', title: 'Supplier portal invite sent',
    message: `Invited ${supplier.name} to the supplier portal`, entityType: 'Supplier', entityId: supplier._id,
  });

  // Delivery (email/SMS/copy-link) is the controller's job, same as portalService.
  return { supplierPortalUserId: portalUser._id, inviteToken };
}

/** Supplier clicks their invite link and sets a real password for the first time. */
async function activateInvite(inviteToken, password) {
  if (!password || password.length < 8) throw new Error('Password must be at least 8 characters.');
  let payload;
  try {
    payload = jwt.verify(inviteToken, process.env.JWT_SECRET);
  } catch {
    throw new Error('This invite link is invalid or has expired.');
  }
  if (!payload.invite) throw new Error('Not a valid invite token.');

  const portalUser = await SupplierPortalUser.findById(payload.supplierPortalUserId);
  if (!portalUser) throw new Error('Invite not found.');

  portalUser.passwordHash = await bcrypt.hash(password, 10);
  portalUser.isActive = true;
  portalUser.activatedAt = new Date();
  await portalUser.save();
  return portalUser;
}

async function login({ email, password, deviceContext }) {
  const portalUser = await SupplierPortalUser.findOne({ email: email.toLowerCase().trim() });
  if (!portalUser || !portalUser.isActive) throw new Error('Invalid email or password.');

  const valid = await bcrypt.compare(password, portalUser.passwordHash);
  if (!valid) throw new Error('Invalid email or password.');

  portalUser.lastLoginAt = new Date();
  await portalUser.save();

  const accessToken = signPortalAccessToken(portalUser);
  const refreshToken = await refreshTokenService.issue('SupplierPortalUser', portalUser._id, deviceContext);
  return { accessToken, refreshToken, supplierId: portalUser.supplierId };
}

/** The portal home view: outstanding payable balance and recent activity, straight from the real payable ledger. */
async function dashboard(supplierId) {
  const ledgerResult = await supplierLedgerService.ledger(supplierId);
  const recentOrders = await PurchaseOrder.find({ supplierId }).sort({ createdAt: -1 }).limit(10)
    .select('poNumber status totalAmount dueAmount orderDate createdAt');
  return {
    closingBalance: ledgerResult.closingBalance,
    recentEntries: ledgerResult.entries.slice(-10).reverse(),
    recentOrders,
  };
}

function myPurchaseOrders(supplierId, { status } = {}) {
  const filter = { supplierId };
  if (status) filter.status = status;
  return PurchaseOrder.find(filter).sort({ createdAt: -1 });
}

async function getPurchaseOrder(supplierId, poId) {
  const po = await PurchaseOrder.findOne({ _id: poId, supplierId });
  if (!po) throw new Error('Purchase order not found.');
  return po;
}

/** Full payable ledger (entries + closing balance), same underlying data as dashboard(), unpaginated. */
async function myPayments(supplierId) {
  return supplierLedgerService.ledger(supplierId);
}

/** Exchanges a refresh token for a new access token, same rotation-with-reuse-detection flow the staff/customer-portal sessions use. */
async function refresh(rawRefreshToken) {
  const { subjectType, subjectId, newToken } = await refreshTokenService.rotate(rawRefreshToken);
  if (subjectType !== 'SupplierPortalUser') throw new Error('Invalid refresh token.');
  const portalUser = await SupplierPortalUser.findById(subjectId);
  if (!portalUser || !portalUser.isActive) throw new Error('Invalid or inactive portal account.');
  return { accessToken: signPortalAccessToken(portalUser), refreshToken: newToken };
}

module.exports = {
  invite, activateInvite, login, refresh, dashboard,
  myPurchaseOrders, getPurchaseOrder, myPayments,
};
