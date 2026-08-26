/**
 * FieldServiceService — dispatching a technician to a CUSTOMER's site for a
 * job (HVAC repair at a customer's house, an on-site install, a field
 * inspection). Distinct from ServiceOrderService (in-shop job card, the item
 * comes to you) and MaintenanceService (against the company's OWN assets).
 * Parts are drawn from inventory as they're used (same "not all reserved
 * upfront" reasoning as ServiceOrder — a technician often doesn't know the
 * full parts list until they're on site), and billing bills parts + a labor
 * line via a direct Sale, same "physical use = stock event, billing =
 * revenue event" separation ServiceOrderService established.
 */
const mongoose = require('mongoose');
const FieldServiceJob = require('../models/FieldServiceJob');
const inventoryService = require('./inventoryService');

const STATUS_TRANSITIONS = {
  scheduled: ['en_route', 'cancelled'],
  en_route: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
};

function createJob(input) {
  const {
    companyId, branchId, warehouseId, customerId, siteAddress, assignedTechnicianId,
    scheduledAt, jobType, description, checklist, userId,
  } = input;
  if (!siteAddress) throw new Error('siteAddress is required.');
  if (!customerId) throw new Error('customerId is required.');
  if (!scheduledAt) throw new Error('scheduledAt is required.');
  return FieldServiceJob.create({
    companyId, branchId, warehouseId, customerId, siteAddress, assignedTechnicianId,
    scheduledAt, jobType, description, userId,
    checklist: (checklist || []).map((item) => (typeof item === 'string' ? { item, done: false } : item)),
    status: 'scheduled',
  });
}

async function updateStatus(jobId, status) {
  const job = await FieldServiceJob.findById(jobId);
  if (!job) throw new Error('Field service job not found.');

  const allowed = STATUS_TRANSITIONS[job.status] || [];
  if (status !== job.status && !allowed.includes(status)) {
    throw new Error(`Cannot move a job from "${job.status}" to "${status}".`);
  }

  job.status = status;
  await job.save();
  return job;
}

async function updateChecklist(jobId, checklist) {
  if (!Array.isArray(checklist)) throw new Error('checklist must be an array.');
  const job = await FieldServiceJob.findByIdAndUpdate(
    jobId,
    { checklist: checklist.map(({ item, done }) => ({ item, done: !!done })) },
    { new: true }
  );
  if (!job) throw new Error('Field service job not found.');
  return job;
}

/** Draws a part from inventory and adds it to the job's bill of parts, in one step. */
async function addPart(jobId, { productId, variantId, quantity, unitPrice, userId }) {
  const session = await mongoose.startSession();
  try {
    let job;
    await session.withTransaction(async () => {
      job = await FieldServiceJob.findById(jobId).session(session);
      if (!job) throw new Error('Field service job not found.');
      if (['completed', 'cancelled'].includes(job.status)) {
        throw new Error(`Cannot add parts to a field service job with status "${job.status}".`);
      }

      await inventoryService.assertSufficientStock(job.warehouseId, variantId, null, quantity);
      await inventoryService.recordMovement({
        companyId: job.companyId, warehouseId: job.warehouseId,
        productId, variantId, type: 'adjustment', quantity: -quantity,
        referenceType: 'FieldServiceJob', referenceId: job._id, userId,
        note: `Part used on field service job at "${job.siteAddress}"`,
      }, session);
      // Deducts stock immediately at use-time, ahead of billing — same
      // reasoning as ServiceOrder.addPart(): the technician physically
      // installs the part now, not when the invoice is eventually printed.

      job.partsUsed.push({ productId, variantId, quantity, unitPrice });
      await job.save({ session });
    });
    return job;
  } finally {
    session.endSession();
  }
}

function setLaborCharge(jobId, laborCharge) {
  return FieldServiceJob.findByIdAndUpdate(jobId, { laborCharge }, { new: true });
}

/**
 * Bills the job: parts (already physically deducted via addPart, so this
 * must NOT deduct them again) plus a labor line, as an ad-hoc,
 * non-inventory-tracked charge billed through a dedicated "Labor" service
 * product, same pattern as ServiceOrderService.billServiceOrder.
 */
async function billJob(jobId, { laborProductId, laborVariantId, paymentAccountId, warehouseId, posTerminalId, userId, completionNotes, customerSignatureName }) {
  const job = await FieldServiceJob.findById(jobId);
  if (!job) throw new Error('Field service job not found.');
  if (job.status !== 'completed') throw new Error('Field service job must be marked "completed" before billing.');

  const Sale = require('../models/Sale');
  const Account = require('../models/Account');
  const { computeLineItems } = require('./saleCalculations');
  const { nextInvoiceNumber, nextDocumentNumber } = require('./numberingService');
  const accountingService = require('./accountingService');

  const items = job.partsUsed.map((p) => ({
    productId: p.productId, variantId: p.variantId, quantity: p.quantity, unitPrice: p.unitPrice,
  }));
  if (job.laborCharge > 0) {
    if (!laborProductId || !laborVariantId) {
      throw new Error('laborProductId/laborVariantId are required when the job has a labor charge (a company "Labor" service product).');
    }
    items.push({ productId: laborProductId, variantId: laborVariantId, quantity: 1, unitPrice: job.laborCharge });
  }
  if (items.length === 0) throw new Error('Nothing to bill — no parts used and no labor charge set.');

  const session = await mongoose.startSession();
  try {
    let sale;
    await session.withTransaction(async () => {
      const { lineItems, subtotal, discountTotal, taxTotal, totalAmount } = computeLineItems(items);
      const invoiceNumber = posTerminalId ? await nextInvoiceNumber(posTerminalId, session) : nextDocumentNumber('INV');

      [sale] = await Sale.create(
        [{
          companyId: job.companyId, branchId: job.branchId,
          warehouseId: warehouseId || job.warehouseId, posTerminalId, customerId: job.customerId, userId,
          documentNumber: invoiceNumber, invoiceNumber, status: 'completed', saleType: 'pos',
          items: lineItems, payments: paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: totalAmount }] : [],
          subtotal, discountAmount: discountTotal, taxAmount: taxTotal,
          totalAmount, paidAmount: paymentAccountId ? totalAmount : 0, dueAmount: paymentAccountId ? 0 : totalAmount,
        }],
        { session }
      );

      const revenueAccount = (await Account.findOne({ companyId: job.companyId, type: 'income', isActive: true }).session(session))?._id;
      if (revenueAccount) {
        const entries = [];
        if (paymentAccountId) entries.push({ accountId: paymentAccountId, debit: totalAmount, credit: 0 });
        entries.push({ accountId: revenueAccount, debit: 0, credit: subtotal - discountTotal });
        await accountingService.postVoucher({
          companyId: job.companyId, branchId: job.branchId, type: 'receipt',
          narration: `Field service job billed: ${job.siteAddress}`,
          entries, referenceType: 'Sale', referenceId: sale._id, userId,
        }, session);
      }

      job.saleId = sale._id;
      if (completionNotes) job.completionNotes = completionNotes;
      if (customerSignatureName) job.customerSignatureName = customerSignatureName;
      await job.save({ session });
    });
    return { sale, job };
  } finally {
    session.endSession();
  }
}

function listJobs(companyId, { status, assignedTechnicianId, from, to } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (assignedTechnicianId) filter.assignedTechnicianId = assignedTechnicianId;
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to) filter.scheduledAt.$lte = new Date(to);
  }
  return FieldServiceJob.find(filter).sort({ scheduledAt: -1 }).limit(200);
}

/** The actual "dispatch board" query — one technician's jobs across a date range. */
function technicianSchedule(companyId, assignedTechnicianId, { from, to } = {}) {
  const filter = { companyId, assignedTechnicianId };
  if (from || to) {
    filter.scheduledAt = {};
    if (from) filter.scheduledAt.$gte = new Date(from);
    if (to) filter.scheduledAt.$lte = new Date(to);
  }
  return FieldServiceJob.find(filter).sort({ scheduledAt: 1 });
}

module.exports = {
  createJob, updateStatus, updateChecklist, addPart, setLaborCharge, billJob, listJobs, technicianSchedule,
};
