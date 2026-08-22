/**
 * SocietyService — generateSocietyInvoices() is School's exact
 * generateFeeInvoices() pattern, applied to society members instead of
 * students: a unique DB index makes re-running a billing period for the
 * whole society a genuine no-op (never a duplicate charge), caught via
 * MongoDB's real duplicate-key error 11000, not a manual "have we already
 * billed this" pre-check that could race under concurrent runs.
 */
const SocietyCharge = require('../models/SocietyCharge');
const SocietyInvoice = require('../models/SocietyInvoice');
const SocietyMember = require('../models/SocietyMember');
const SocietyComplaint = require('../models/SocietyComplaint');
const posSaleService = require('../../../services/posSaleService');

function createCharge(input) {
  const { companyId, name, amount, billingProductId, billingVariantId } = input;
  if (!amount || amount <= 0) throw new Error('amount must be greater than zero.');
  return SocietyCharge.create({ companyId, name, amount, billingProductId, billingVariantId });
}

function listCharges(companyId) {
  return SocietyCharge.find({ companyId, isActive: true });
}

function enrollMember(input) {
  const { companyId, propertyId, residentCustomerId } = input;
  return SocietyMember.create({ companyId, propertyId, residentCustomerId });
}

function listMembers(companyId) {
  return SocietyMember.find({ companyId, status: 'active' }).populate('propertyId', 'unitNumber').populate('residentCustomerId', 'name');
}

/**
 * One invoice per active member per charge per period — regenerating an
 * already-billed period is a silent no-op via the real unique index,
 * exactly School's pattern, not reimplemented differently here.
 */
async function generateSocietyInvoices({ companyId, chargeId, period, dueDate }) {
  const charge = await SocietyCharge.findOne({ _id: chargeId, companyId, isActive: true });
  if (!charge) throw new Error('Society charge not found.');

  const members = await SocietyMember.find({ companyId, status: 'active' });

  const created = [];
  const skipped = [];
  for (const member of members) {
    try {
      const invoice = await SocietyInvoice.create({
        companyId, propertyId: member.propertyId, residentCustomerId: member.residentCustomerId,
        chargeId: charge._id, period, amount: charge.amount, dueDate,
      });
      created.push(invoice);
    } catch (err) {
      if (err.code === 11000) skipped.push(member._id); // already billed for this period — not an error
      else throw err;
    }
  }

  return { created, skippedCount: skipped.length, totalEligible: members.length };
}

function listInvoices(companyId, { propertyId, residentCustomerId, status, period } = {}) {
  const filter = { companyId };
  if (propertyId) filter.propertyId = propertyId;
  if (residentCustomerId) filter.residentCustomerId = residentCustomerId;
  if (status) filter.status = status;
  if (period) filter.period = period;
  return SocietyInvoice.find(filter).populate('propertyId', 'unitNumber').populate('residentCustomerId', 'name').populate('chargeId', 'name').sort({ dueDate: 1 });
}

async function payInvoice(invoiceId, { branchId, warehouseId, paymentAccountId, posTerminalId, userId }) {
  const invoice = await SocietyInvoice.findById(invoiceId);
  if (!invoice) throw new Error('Invoice not found.');
  if (invoice.status !== 'pending' && invoice.status !== 'overdue') throw new Error(`Cannot pay an invoice with status "${invoice.status}".`);

  const charge = await SocietyCharge.findById(invoice.chargeId);
  const sale = await posSaleService.checkout({
    companyId: invoice.companyId, branchId, warehouseId, customerId: invoice.residentCustomerId, posTerminalId, userId,
    items: [{ productId: charge.billingProductId, variantId: charge.billingVariantId, quantity: 1, unitPrice: invoice.amount }],
    payments: [{ paymentAccountId, method: 'cash', amount: invoice.amount }],
  });

  invoice.status = 'paid';
  invoice.saleId = sale._id;
  await invoice.save();
  return { invoice, sale };
}

function submitComplaint(input) {
  const { companyId, propertyId, residentCustomerId, category, description, priority } = input;
  return SocietyComplaint.create({ companyId, propertyId, residentCustomerId, category, description, priority: priority || 'medium' });
}

async function assignComplaint(complaintId, { assignedToUserId }) {
  const complaint = await SocietyComplaint.findById(complaintId);
  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.status !== 'open') throw new Error(`Cannot assign a complaint with status "${complaint.status}".`);
  complaint.assignedToUserId = assignedToUserId;
  complaint.status = 'assigned';
  await complaint.save();
  return complaint;
}

async function resolveComplaint(complaintId, { resolutionNote }) {
  const complaint = await SocietyComplaint.findById(complaintId);
  if (!complaint) throw new Error('Complaint not found.');
  if (complaint.status !== 'assigned') throw new Error(`Cannot resolve a complaint with status "${complaint.status}" — it must be assigned first.`);
  complaint.status = 'resolved';
  complaint.resolutionNote = resolutionNote;
  await complaint.save();
  return complaint;
}

function listComplaints(companyId, { propertyId, status } = {}) {
  const filter = { companyId };
  if (propertyId) filter.propertyId = propertyId;
  if (status) filter.status = status;
  return SocietyComplaint.find(filter).sort({ createdAt: -1 });
}

module.exports = {
  createCharge, listCharges, enrollMember, listMembers, generateSocietyInvoices, listInvoices, payInvoice,
  submitComplaint, assignComplaint, resolveComplaint, listComplaints,
};
