/**
 * WarrantyService — serial-tied warranty eligibility and claims. The
 * mechanic this module exists for: a POINT-IN-TIME validity window on one
 * specific physical unit, not a threshold that gets crossed (Service
 * Station's mileage) or a queue position (Hospital) or shared capacity
 * (Gym). "Is this exact serial still covered right now" is a yes/no
 * question about a fixed window, checked fresh on every read.
 */
const mongoose = require('mongoose');
const Warranty = require('../models/Warranty');
const WarrantyClaim = require('../models/WarrantyClaim');
const ProductSerial = require('../../../models/ProductSerial');
const serviceOrderService = require('../../../services/serviceOrderService');

/**
 * Registers a warranty for a specific sold serial — validates the serial
 * actually exists and was actually sold (status 'sold'), the real
 * ProductSerial record this module reuses rather than trusting a
 * caller-supplied serialNumber blindly.
 */
async function registerWarranty(input) {
  const { companyId, serialNumber, warrantyMonths, startDate, customerId, saleId } = input;
  if (!serialNumber || !warrantyMonths) throw new Error('serialNumber and warrantyMonths are required.');

  const serial = await ProductSerial.findOne({ companyId, serialNumber });
  if (!serial) throw new Error(`No serial record found for "${serialNumber}" — it must be received and sold through inventory first.`);
  if (serial.status !== 'sold') throw new Error(`Serial "${serialNumber}" has status "${serial.status}" — a warranty only makes sense for a unit that's actually been sold.`);

  const start = startDate ? new Date(startDate) : new Date();
  const expiryDate = new Date(start);
  expiryDate.setMonth(expiryDate.getMonth() + warrantyMonths);

  return Warranty.create({
    companyId, productId: serial.productId, variantId: serial.variantId, serialNumber,
    customerId, saleId: saleId || serial.saleId, warrantyMonths, startDate: start, expiryDate,
  });
}

/**
 * The core eligibility check — a real Warranty record found for this
 * serial, and whether today falls before its stored expiryDate. Returns
 * enough for a UI to show "covered until X" or "expired Y days ago"
 * either way, not just a bare boolean.
 */
async function checkWarranty(companyId, serialNumber) {
  const warranty = await Warranty.findOne({ companyId, serialNumber });
  if (!warranty) return { found: false, underWarranty: false };

  const now = new Date();
  const underWarranty = now <= warranty.expiryDate;
  const daysDiff = Math.round((warranty.expiryDate - now) / (1000 * 60 * 60 * 24));

  return {
    found: true, underWarranty, warranty,
    daysRemaining: underWarranty ? daysDiff : 0,
    daysExpired: underWarranty ? 0 : Math.abs(daysDiff),
  };
}

/** Rejects outright at submission time if the warranty has already expired — a real business rule, not left for a human to notice later. */
async function submitClaim(warrantyId, { issueDescription, userId }) {
  const warranty = await Warranty.findById(warrantyId);
  if (!warranty) throw new Error('Warranty not found.');
  if (new Date() > warranty.expiryDate) throw new Error(`This warranty expired on ${warranty.expiryDate.toDateString()} — no new claims can be submitted against it.`);

  return WarrantyClaim.create({ companyId: warranty.companyId, warrantyId, issueDescription, userId });
}

async function decideClaim(claimId, { approve, decisionNote }) {
  const claim = await WarrantyClaim.findById(claimId);
  if (!claim) throw new Error('Claim not found.');
  if (claim.status !== 'submitted') throw new Error(`Cannot decide a claim with status "${claim.status}".`);

  claim.status = approve ? 'approved' : 'rejected';
  claim.decisionNote = decisionNote;
  await claim.save();
  return claim;
}

/** Opens the actual repair job — a real core ServiceOrder, not a duplicate concept. Requires the claim to already be approved. */
async function linkRepairJob(claimId, jobCardInput) {
  const session = await mongoose.startSession();
  try {
    let claim;
    await session.withTransaction(async () => {
      claim = await WarrantyClaim.findById(claimId).session(session);
      if (!claim) throw new Error('Claim not found.');
      if (claim.status !== 'approved') throw new Error(`Cannot open a repair job for a claim with status "${claim.status}" — it must be approved first.`);

      const jobCard = await serviceOrderService.create({ ...jobCardInput, companyId: claim.companyId });
      claim.serviceOrderId = jobCard._id;
      claim.status = 'in_repair';
      await claim.save({ session });
    });
    return claim;
  } finally {
    session.endSession();
  }
}

async function resolveClaim(claimId) {
  const claim = await WarrantyClaim.findByIdAndUpdate(claimId, { status: 'resolved' }, { new: true });
  if (!claim) throw new Error('Claim not found.');
  return claim;
}

function listClaims(companyId, warrantyId) {
  const filter = { companyId };
  if (warrantyId) filter.warrantyId = warrantyId;
  return WarrantyClaim.find(filter).sort({ createdAt: -1 });
}

/** Corrects a mistakenly-registered warranty (wrong startDate/warrantyMonths typed at registration) — recomputes expiryDate the same way registerWarranty does. Locked the moment any claim has ever been submitted against it: submitClaim/checkWarranty both depend on expiryDate being stable once a claim's expired/active determination has actually been made against it. */
async function updateWarranty(warrantyId, { warrantyMonths, startDate }) {
  const warranty = await Warranty.findById(warrantyId);
  if (!warranty) throw new Error('Warranty not found.');

  const anyClaimExists = await WarrantyClaim.findOne({ warrantyId });
  if (anyClaimExists) throw new Error('Cannot edit a warranty that already has a claim on file — its coverage window is now real claim history.');

  if (warrantyMonths !== undefined) {
    if (!warrantyMonths || warrantyMonths <= 0) throw new Error('warrantyMonths must be greater than zero.');
    warranty.warrantyMonths = warrantyMonths;
  }
  if (startDate !== undefined) warranty.startDate = new Date(startDate);

  const expiryDate = new Date(warranty.startDate);
  expiryDate.setMonth(expiryDate.getMonth() + warranty.warrantyMonths);
  warranty.expiryDate = expiryDate;

  await warranty.save();
  return warranty;
}

module.exports = { registerWarranty, checkWarranty, updateWarranty, submitClaim, decideClaim, linkRepairJob, resolveClaim, listClaims };
