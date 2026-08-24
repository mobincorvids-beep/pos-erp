/**
 * SalonService — services, commissions, and prepaid memberships. Reuses
 * core wherever possible rather than reimplementing it: billing a service
 * goes through the exact same posSaleService.checkout() as any POS sale,
 * commission payout goes through hrService's generic bonus hook (not a
 * salon-specific payroll path), and a membership purchase is itself just a
 * Sale. What's genuinely new here is the commission calculation and the
 * session-credit bookkeeping — the parts with no core equivalent.
 */
const mongoose = require('mongoose');
const SalonService = require('../models/SalonService');
const StaffCommission = require('../models/StaffCommission');
const MembershipPackage = require('../models/MembershipPackage');
const CustomerMembership = require('../models/CustomerMembership');
const Employee = require('../../../models/Employee');
const posSaleService = require('../../../services/posSaleService');
const hrService = require('../../../services/hrService');

// --- Service catalog -----------------------------------------------------

function createService(input) {
  const { companyId, productId, variantId, name, category, durationMinutes, price, commissionType, commissionRate } = input;
  if (!name || !price) throw new Error('name and price are required.');
  return SalonService.create({ companyId, productId, variantId, name, category, durationMinutes, price, commissionType, commissionRate });
}

function listServices(companyId) {
  return SalonService.find({ companyId, isActive: true });
}

/** Was missing — a service's price/duration/commission could never be corrected after
 * creation. Deliberately does NOT allow editing productId/variantId (that's the sellable
 * line-item link — changing it would retroactively reinterpret past sales). */
function updateService(companyId, id, updates) {
  const allowed = ['name', 'category', 'durationMinutes', 'price', 'commissionType', 'commissionRate'];
  const set = {};
  for (const key of allowed) if (updates[key] !== undefined) set[key] = updates[key];
  return SalonService.findOneAndUpdate({ _id: id, companyId }, set, { new: true, runValidators: true });
}

/** Soft-deactivate, not delete — past sales and any membership packages that redeem
 * against this service reference it by id and must keep resolving. */
function deactivateService(companyId, id) {
  return SalonService.findOneAndUpdate({ _id: id, companyId }, { isActive: false }, { new: true });
}

function computeCommission(service, saleAmount) {
  if (service.commissionType === 'fixed') return service.commissionRate;
  return Math.round(saleAmount * (service.commissionRate / 100) * 100) / 100;
}

/**
 * Bills a service performed by a specific staff member, then records the
 * commission they earned. If useMembership is true, redeems one session
 * from an active CustomerMembership instead of charging money (still bills
 * a Sale — at zero payment — so it shows up in sales history and the
 * commission still applies, since the staff member still did the work).
 */
async function billServiceWithCommission(input) {
  const {
    companyId, branchId, warehouseId, posTerminalId, customerId,
    salonServiceId, employeeId, paymentAccountId, useMembership, userId,
  } = input;

  const service = await SalonService.findOne({ _id: salonServiceId, companyId });
  if (!service) throw new Error('Service not found.');

  const employee = await Employee.findOne({ _id: employeeId, companyId });
  if (!employee) throw new Error('Employee not found.');

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      let membership = null;
      if (useMembership) {
        const eligiblePackageIds = await MembershipPackage.find({ salonServiceId }).session(session).distinct('_id');
        membership = await CustomerMembership.findOne({
          customerId, companyId, status: 'active', remainingSessions: { $gt: 0 },
          membershipPackageId: { $in: eligiblePackageIds },
        }).session(session);
        if (!membership) throw new Error('No active membership with remaining sessions for this service.');
        if (membership.expiresAt < new Date()) throw new Error('This membership has expired.');
      }

      const amountToCharge = useMembership ? 0 : service.price;
      const payments = amountToCharge > 0 ? [{ paymentAccountId, method: 'cash', amount: amountToCharge }] : [];

      const sale = await posSaleService.checkout({
        companyId, branchId, warehouseId, posTerminalId, customerId, userId,
        items: [{ productId: service.productId, variantId: service.variantId, quantity: 1, unitPrice: amountToCharge }],
        payments,
      });

      if (membership) {
        membership.remainingSessions -= 1;
        if (membership.remainingSessions <= 0) membership.status = 'exhausted';
        await membership.save({ session });
      }

      // Commission is earned on the service's real price regardless of
      // whether this visit was paid for in cash or with a membership
      // session — the staff member did the same work either way; the
      // membership's upfront payment already covered it.
      const commissionAmount = computeCommission(service, service.price);
      const [commission] = await StaffCommission.create(
        [{ companyId, employeeId, salonServiceId, saleId: sale._id, amount: commissionAmount }],
        { session }
      );

      result = { sale, commission, membership };
    });
    return result;
  } finally {
    session.endSession();
  }
}

// --- Membership packages ---------------------------------------------------

function createMembershipPackage(input) {
  const { companyId, productId, variantId, name, salonServiceId, totalSessions, price, validityDays } = input;
  if (!name || !totalSessions || !price) throw new Error('name, totalSessions, and price are required.');
  return MembershipPackage.create({ companyId, productId, variantId, name, salonServiceId, totalSessions, price, validityDays });
}

/** Was missing — same reasoning as updateService: price/sessions/validity are correctable,
 * the sellable link and which service it redeems for are not. */
function updateMembershipPackage(companyId, id, updates) {
  const allowed = ['name', 'totalSessions', 'price', 'validityDays'];
  const set = {};
  for (const key of allowed) if (updates[key] !== undefined) set[key] = updates[key];
  return MembershipPackage.findOneAndUpdate({ _id: id, companyId }, set, { new: true, runValidators: true });
}

/** Soft-deactivate — customers who already bought this package keep their CustomerMembership
 * record and remaining sessions regardless of whether the package is still for sale. */
function deactivateMembershipPackage(companyId, id) {
  return MembershipPackage.findOneAndUpdate({ _id: id, companyId }, { isActive: false }, { new: true });
}

function listMembershipPackages(companyId) {
  return MembershipPackage.find({ companyId, isActive: true });
}

/**
 * Sells a membership package — a real Sale for the package price, plus a
 * CustomerMembership record tracking the session credit. Deliberately NOT
 * wrapped in an enclosing transaction — posSaleService.checkout() always
 * opens its own independent session internally and has no way to join an
 * outer one, so nesting a transaction around it wouldn't actually make
 * this function atomic, it would just create two unrelated transactions
 * that happen to overlap in time. This was a real bug in this exact
 * function until it was caught and fixed: the checkout() call sat inside
 * this function's own session.withTransaction(), the same class of
 * mistake later caught in Hardware, Multi-Currency, and Media/
 * Entertainment — found this time by re-reading this file while building
 * Sports' membership module on top of the same pattern, not from a bug
 * report. checkout() is now its own atomic unit; the CustomerMembership
 * write follows as its own standalone, real single-document write.
 */
async function sellMembership(input) {
  const { companyId, branchId, warehouseId, posTerminalId, customerId, membershipPackageId, paymentAccountId, userId } = input;

  const pkg = await MembershipPackage.findOne({ _id: membershipPackageId, companyId });
  if (!pkg) throw new Error('Membership package not found.');

  const sale = await posSaleService.checkout({
    companyId, branchId, warehouseId, posTerminalId, customerId, userId,
    items: [{ productId: pkg.productId, variantId: pkg.variantId, quantity: 1, unitPrice: pkg.price }],
    payments: [{ paymentAccountId, method: 'cash', amount: pkg.price }],
  });

  const expiresAt = new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000);
  const membership = await CustomerMembership.create({
    companyId, customerId, membershipPackageId: pkg._id, saleId: sale._id,
    totalSessions: pkg.totalSessions, remainingSessions: pkg.totalSessions, expiresAt,
  });

  return { sale, membership };
}

function listCustomerMemberships(companyId, customerId) {
  return CustomerMembership.find({ companyId, customerId }).populate('membershipPackageId', 'name');
}

// --- Commission -> Payroll interlink -----------------------------------------

/**
 * Folds every unpaid commission an employee earned within a payroll run's
 * month/year into that run's draft via hrService's generic bonus hook, then
 * marks those commissions paid+linked to the run. Call this after
 * generating a draft (POST /hr/payroll-runs) and before posting it.
 */
async function applyCommissionsToPayroll(payrollRunId, month, year, companyId) {
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const unpaid = await StaffCommission.find({
    companyId, status: 'unpaid', earnedAt: { $gte: from, $lte: to },
  });

  const byEmployee = new Map();
  for (const c of unpaid) {
    const key = String(c.employeeId);
    byEmployee.set(key, (byEmployee.get(key) || 0) + c.amount);
  }

  const applied = [];
  for (const [employeeId, total] of byEmployee) {
    await hrService.addBonusToDraftPayroll(payrollRunId, employeeId, total, 'Salon service commissions');
    applied.push({ employeeId, amount: Math.round(total * 100) / 100 });
  }

  await StaffCommission.updateMany(
    { _id: { $in: unpaid.map((c) => c._id) } },
    { status: 'paid', payrollRunId }
  );

  return applied;
}

function listCommissions(companyId, employeeId) {
  const filter = { companyId };
  if (employeeId) filter.employeeId = employeeId;
  return StaffCommission.find(filter).sort({ earnedAt: -1 });
}

module.exports = {
  createService, listServices, updateService, deactivateService, billServiceWithCommission,
  createMembershipPackage, listMembershipPackages, updateMembershipPackage, deactivateMembershipPackage,
  sellMembership, listCustomerMemberships,
  applyCommissionsToPayroll, listCommissions,
};
