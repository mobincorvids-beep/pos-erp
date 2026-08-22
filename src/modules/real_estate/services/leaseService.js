/**
 * LeaseService — the genuinely new mechanic: rent is billed one real
 * period at a time over a tenancy that can run for months or years, and
 * a late payment accrues a REAL late fee proportional to actual days
 * overdue, not a flat penalty — the first genuine "penalty scales with
 * how late it actually is" mechanic in this app. Deliberately uses a
 * fixed 30-day period rather than "1 calendar month" — JS Date month
 * arithmetic has real, well-known edge cases (Jan 31 + 1 month is
 * ambiguous: Feb 28? March 3?), and a fixed 30-day period sidesteps that
 * entirely rather than risk a subtle date bug for a marginal gain in realism.
 */
const Property = require('../models/Property');
const Lease = require('../models/Lease');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

const PERIOD_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

function createProperty(input) {
  const { companyId, branchId, unitNumber, propertyType } = input;
  return Property.create({ companyId, branchId, unitNumber, propertyType });
}

function listProperties(companyId, { status } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  return Property.find(filter);
}

async function startLease(input) {
  const {
    companyId, branchId, propertyId, tenantCustomerId, startDate, endDate, monthlyRent, lateFeePerDay,
    securityDeposit, depositReceivedAccountId, securityDepositLiabilityAccountId, userId,
  } = input;

  const property = await Property.findById(propertyId);
  if (!property) throw new Error('Property not found.');
  if (property.status !== 'available') throw new Error(`This property is not available — current status "${property.status}".`);
  if (!(new Date(startDate) < new Date(endDate))) throw new Error('endDate must be after startDate.');

  if (securityDeposit > 0) {
    await accountingService.postVoucher({
      companyId, branchId, type: 'receipt', narration: `Security deposit — ${property.unitNumber}`,
      entries: [
        { accountId: depositReceivedAccountId, debit: securityDeposit, credit: 0 },
        { accountId: securityDepositLiabilityAccountId, debit: 0, credit: securityDeposit },
      ],
      referenceType: 'Property', referenceId: property._id, userId,
    });
  }

  property.status = 'leased';
  await property.save();

  return Lease.create({
    companyId, branchId, propertyId, tenantCustomerId, startDate, endDate, monthlyRent, lateFeePerDay: lateFeePerDay || 0,
    securityDeposit: securityDeposit || 0, securityDepositLiabilityAccountId, lastRentGeneratedThrough: startDate,
  });
}

function listLeases(companyId, { propertyId, status } = {}) {
  const filter = { companyId };
  if (propertyId) filter.propertyId = propertyId;
  if (status) filter.status = status;
  return Lease.find(filter).populate('tenantCustomerId', 'name').populate('propertyId', 'unitNumber');
}

/**
 * Bills exactly the next unbilled period. The due date is always exactly
 * PERIOD_DAYS after the last period that was actually billed — real
 * lateness is measured against THAT due date, not against "today" in
 * some vague sense. Rejects billing a period whose due date hasn't
 * arrived yet — the same "don't bill early" honesty every other
 * recurring-billing module in this app already holds to.
 */
async function generateRentInvoice(leaseId, { asOfDate, billingProductId, billingVariantId, warehouseId, paymentAccountId, posTerminalId, userId }) {
  const lease = await Lease.findById(leaseId);
  if (!lease) throw new Error('Lease not found.');
  if (lease.status !== 'active') throw new Error(`Cannot bill a lease with status "${lease.status}".`);

  const dueDate = new Date(lease.lastRentGeneratedThrough.getTime() + PERIOD_DAYS * MS_PER_DAY);
  const evalDate = asOfDate ? new Date(asOfDate) : new Date();
  if (evalDate < dueDate) throw new Error(`The next rent period isn't due until ${dueDate.toDateString()}.`);

  const daysLate = Math.max(0, Math.ceil((evalDate - dueDate) / MS_PER_DAY));
  const lateFee = Math.round(daysLate * lease.lateFeePerDay * 100) / 100;
  const totalBill = Math.round((lease.monthlyRent + lateFee) * 100) / 100;

  const sale = await posSaleService.checkout({
    companyId: lease.companyId, branchId: lease.branchId, warehouseId, customerId: lease.tenantCustomerId, posTerminalId, userId,
    items: [{ productId: billingProductId, variantId: billingVariantId, quantity: 1, unitPrice: totalBill }],
    payments: paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: totalBill }] : [],
  });

  lease.lastRentGeneratedThrough = dueDate;
  await lease.save();

  return { sale, dueDate, daysLate, lateFee, totalBill };
}

/**
 * Ends a tenancy — the security deposit is resolved (refunded minus any
 * validated deductions for damage, the same condition-based pattern
 * Hardware's tool-rental return already established), and the property
 * itself cycles back to 'available' — the real proof this is a
 * repeatedly-reusable asset, not a one-time sale.
 */
async function endLease(leaseId, { deductionAmount, refundAccountId, forfeitRevenueAccountId, userId }) {
  const lease = await Lease.findById(leaseId);
  if (!lease) throw new Error('Lease not found.');
  if (lease.status !== 'active') throw new Error(`Cannot end a lease with status "${lease.status}".`);

  const deduction = Math.max(0, Math.min(deductionAmount || 0, lease.securityDeposit));
  const refund = Math.round((lease.securityDeposit - deduction) * 100) / 100;

  if (lease.securityDeposit > 0) {
    const entries = [{ accountId: lease.securityDepositLiabilityAccountId, debit: lease.securityDeposit, credit: 0 }];
    if (refund > 0) {
      if (!refundAccountId) throw new Error('refundAccountId is required when any amount is refunded.');
      entries.push({ accountId: refundAccountId, debit: 0, credit: refund });
    }
    if (deduction > 0) {
      if (!forfeitRevenueAccountId) throw new Error('forfeitRevenueAccountId is required when any amount is deducted for damage.');
      entries.push({ accountId: forfeitRevenueAccountId, debit: 0, credit: deduction });
    }
    await accountingService.postVoucher({
      companyId: lease.companyId, branchId: lease.branchId, type: 'journal', narration: 'Lease ended — security deposit settled',
      entries, referenceType: 'Lease', referenceId: lease._id, userId,
    });
  }

  lease.status = 'ended';
  await lease.save();

  const property = await Property.findById(lease.propertyId);
  property.status = 'available'; // cycles back — the real point of a Property being a reusable asset, not a one-shot sale
  await property.save();

  return { lease, refund, deduction };
}

module.exports = { createProperty, listProperties, startLease, listLeases, generateRentInvoice, endLease };
