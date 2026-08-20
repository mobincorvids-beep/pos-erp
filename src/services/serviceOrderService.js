/**
 * ServiceOrderService — job cards. Parts are drawn from inventory as they're
 * used (not all reserved upfront — a technician often doesn't know the full
 * parts list until diagnosis), and billing reuses PosSaleService.checkout()
 * for parts + a labor line, same "reuse core checkout" pattern as
 * PharmacyService and AppointmentService.
 */
const mongoose = require('mongoose');
const ServiceOrder = require('../models/ServiceOrder');
const Product = require('../models/Product');
const inventoryService = require('./inventoryService');
const posSaleService = require('./posSaleService');

function create(input) {
  const { companyId, branchId, warehouseId, customerId, vehicleId, assignedTechnicianId, itemDescription, reportedIssue, userId } = input;
  if (!itemDescription) throw new Error('itemDescription is required.');
  return ServiceOrder.create({
    companyId, branchId, warehouseId, customerId, vehicleId, assignedTechnicianId,
    itemDescription, reportedIssue, userId, status: 'received',
  });
}

async function updateStatus(serviceOrderId, status, { diagnosisNote } = {}) {
  const valid = ['received', 'diagnosed', 'in_progress', 'completed', 'delivered', 'cancelled'];
  if (!valid.includes(status)) throw new Error(`Invalid status "${status}".`);

  const update = { status };
  if (diagnosisNote) update.diagnosisNote = diagnosisNote;

  const serviceOrder = await ServiceOrder.findByIdAndUpdate(serviceOrderId, update, { new: true });
  if (!serviceOrder) throw new Error('Service order not found.');
  return serviceOrder;
}

/** Draws a part from inventory and adds it to the job card's bill of parts, in one step. */
async function addPart(serviceOrderId, { productId, variantId, quantity, unitPrice, userId }) {
  const session = await mongoose.startSession();
  try {
    let serviceOrder;
    await session.withTransaction(async () => {
      serviceOrder = await ServiceOrder.findById(serviceOrderId).session(session);
      if (!serviceOrder) throw new Error('Service order not found.');
      if (['completed', 'delivered', 'cancelled'].includes(serviceOrder.status)) {
        throw new Error(`Cannot add parts to a service order with status "${serviceOrder.status}".`);
      }

      await inventoryService.assertSufficientStock(serviceOrder.warehouseId, variantId, null, quantity);
      await inventoryService.recordMovement({
        companyId: serviceOrder.companyId, warehouseId: serviceOrder.warehouseId,
        productId, variantId, type: 'adjustment', quantity: -quantity,
        referenceType: 'ServiceOrder', referenceId: serviceOrder._id, userId,
        note: `Part used on job card for "${serviceOrder.itemDescription}"`,
      }, session);
      // Note: this deducts stock immediately at use-time, ahead of billing —
      // deliberately, since a technician physically installs the part now,
      // not when the invoice is eventually printed. Billing (below) charges
      // for it but does NOT deduct stock again.

      serviceOrder.partsUsed.push({ productId, variantId, quantity, unitPrice });
      await serviceOrder.save({ session });
    });
    return serviceOrder;
  } finally {
    session.endSession();
  }
}

function setLaborCharge(serviceOrderId, laborCharge) {
  return ServiceOrder.findByIdAndUpdate(serviceOrderId, { laborCharge }, { new: true });
}

/**
 * Bills the job card: parts (already physically deducted via addPart, so
 * checkout here must NOT deduct them again) plus a labor line, as an
 * ad-hoc, non-inventory-tracked charge. Since PosSaleService always deducts
 * stock for every line, labor is passed as a zero-inventory-impact line by
 * using a dedicated "Labor" service product the company must create once
 * (companyId-scoped, trackingMode 'simple', but never stocked/sold via POS
 * normally — quantity is just 1 unit priced at the labor amount).
 */
async function billServiceOrder(serviceOrderId, { laborProductId, laborVariantId, paymentAccountId, warehouseId, posTerminalId, userId }) {
  const serviceOrder = await ServiceOrder.findById(serviceOrderId);
  if (!serviceOrder) throw new Error('Service order not found.');
  if (serviceOrder.status !== 'completed') throw new Error('Service order must be marked "completed" before billing.');

  // Parts are billed at their already-recorded price, but must NOT trigger
  // another stock deduction — PosSaleService always deducts, so parts here
  // are billed through a lightweight direct Sale creation instead of
  // checkout(). This keeps the "physical use = stock event, billing =
  // revenue event" separation addPart() established.
  const Sale = require('../models/Sale');
  const Account = require('../models/Account');
  const { computeLineItems } = require('./saleCalculations');
  const { nextInvoiceNumber, nextDocumentNumber } = require('./numberingService');
  const accountingService = require('./accountingService');

  const items = serviceOrder.partsUsed.map((p) => ({
    productId: p.productId, variantId: p.variantId, quantity: p.quantity, unitPrice: p.unitPrice,
  }));
  if (serviceOrder.laborCharge > 0) {
    if (!laborProductId || !laborVariantId) {
      throw new Error('laborProductId/laborVariantId are required when the service order has a labor charge (a company "Labor" service product).');
    }
    items.push({ productId: laborProductId, variantId: laborVariantId, quantity: 1, unitPrice: serviceOrder.laborCharge });
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
          companyId: serviceOrder.companyId, branchId: serviceOrder.branchId,
          warehouseId: warehouseId || serviceOrder.warehouseId, posTerminalId, customerId: serviceOrder.customerId, userId,
          documentNumber: invoiceNumber, invoiceNumber, status: 'completed', saleType: 'pos',
          items: lineItems, payments: paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: totalAmount }] : [],
          subtotal, discountAmount: discountTotal, taxAmount: taxTotal,
          totalAmount, paidAmount: paymentAccountId ? totalAmount : 0, dueAmount: paymentAccountId ? 0 : totalAmount,
        }],
        { session }
      );

      const revenueAccount = (await Account.findOne({ companyId: serviceOrder.companyId, type: 'income', isActive: true }).session(session))?._id;
      if (revenueAccount) {
        const entries = [];
        if (paymentAccountId) entries.push({ accountId: paymentAccountId, debit: totalAmount, credit: 0 });
        entries.push({ accountId: revenueAccount, debit: 0, credit: subtotal - discountTotal });
        await accountingService.postVoucher({
          companyId: serviceOrder.companyId, branchId: serviceOrder.branchId, type: 'receipt',
          narration: `Service order billed: ${serviceOrder.itemDescription}`,
          entries, referenceType: 'Sale', referenceId: sale._id, userId,
        }, session);
      }

      serviceOrder.saleId = sale._id;
      serviceOrder.status = 'delivered';
      await serviceOrder.save({ session });
    });
    return { sale, serviceOrder };
  } finally {
    session.endSession();
  }
}

module.exports = { create, updateStatus, addPart, setLaborCharge, billServiceOrder };
