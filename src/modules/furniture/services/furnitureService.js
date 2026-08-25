/**
 * FurnitureService — made-to-order custom pieces. Deliberately built as an
 * interlink hub rather than a new core mechanic: the deposit reuses
 * Hotel/Banquet's exact liability pattern, and production reuses the real
 * core Manufacturing module (createWorkOrder/completeProduction)
 * unchanged — this module never touches BOM logic, material consumption,
 * or costing itself. What IS genuinely new: on-time delivery tracking,
 * comparing promisedDeliveryDate against what actually happened, something
 * no report or AI/BI function in this app currently computes.
 */
const mongoose = require('mongoose');
const CustomOrder = require('../models/CustomOrder');
const manufacturingService = require('../../../services/manufacturingService');
const WorkOrder = require('../../../models/WorkOrder');
const BillOfMaterials = require('../../../models/BillOfMaterials');
const posSaleService = require('../../../services/posSaleService');
const accountingService = require('../../../services/accountingService');

async function placeOrder(input) {
  const {
    companyId, branchId, customerId, description, promisedDeliveryDate, price,
    depositAmount, depositReceivedInAccountId, depositLiabilityAccountId, userId,
  } = input;
  if (!promisedDeliveryDate || !price) throw new Error('promisedDeliveryDate and price are required.');

  const session = await mongoose.startSession();
  try {
    let order;
    await session.withTransaction(async () => {
      [order] = await CustomOrder.create(
        [{
          companyId, branchId, customerId, description, promisedDeliveryDate, price,
          depositAmount: depositAmount || 0,
          depositReceivedInAccountId: depositAmount ? depositReceivedInAccountId : null,
          depositLiabilityAccountId: depositAmount ? depositLiabilityAccountId : null,
        }],
        { session }
      );

      if (depositAmount > 0) {
        if (!depositReceivedInAccountId || !depositLiabilityAccountId) {
          throw new Error('depositReceivedInAccountId and depositLiabilityAccountId are required when taking a deposit.');
        }
        await accountingService.postVoucher({
          companyId, branchId, type: 'receipt', narration: `Deposit for custom order`,
          entries: [
            { accountId: depositReceivedInAccountId, debit: depositAmount, credit: 0 },
            { accountId: depositLiabilityAccountId, debit: 0, credit: depositAmount },
          ],
          referenceType: 'CustomOrder', referenceId: order._id, userId,
        }, session);
      }
    });
    return order;
  } finally {
    session.endSession();
  }
}

/** Was missing — a custom order's description/price/promised date could never be
 * corrected after placing it. Only allowed while still 'ordered' (pre-production):
 * once a WorkOrder exists, the price and spec are what production was actually
 * costed and started against, so they lock. Deliberately never allows editing
 * deposit fields here — a deposit is real posted money; changing it needs its own
 * voucher-aware flow, not a silent field edit. */
async function updateOrder(companyId, id, updates) {
  const order = await CustomOrder.findOne({ _id: id, companyId });
  if (!order) throw new Error('Custom order not found.');
  if (order.status !== 'ordered') throw new Error(`Cannot edit an order with status "${order.status}" — only orders not yet in production can be edited.`);

  const allowed = ['description', 'promisedDeliveryDate', 'price'];
  for (const key of allowed) if (updates[key] !== undefined) order[key] = updates[key];
  await order.save();
  return order;
}

/**
 * Cancels an order before delivery. Mirrors Hardware's void-rental pattern: reverses
 * whatever was actually posted rather than just flipping a status flag. If a deposit
 * was taken, it must be settled one of two ways — refunded back to the customer
 * (refundAccountId) or forfeited to company income (forfeitIncomeAccountId) — so the
 * deposit liability never sits open on an order that's going nowhere. Refuses to
 * cancel an order that's already been delivered/billed (that needs a return, not a cancel).
 */
async function cancelOrder(companyId, id, { refundAccountId, forfeitIncomeAccountId, userId } = {}) {
  const order = await CustomOrder.findOne({ _id: id, companyId });
  if (!order) throw new Error('Custom order not found.');
  if (order.status === 'delivered') throw new Error('Cannot cancel a delivered order.');
  if (order.status === 'cancelled') throw new Error('This order is already cancelled.');

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      if (order.depositAmount > 0) {
        if (!refundAccountId && !forfeitIncomeAccountId) {
          throw new Error('A deposit was taken — provide refundAccountId (to refund it) or forfeitIncomeAccountId (to forfeit it) to cancel.');
        }
        const settleAccountId = refundAccountId || forfeitIncomeAccountId;
        await accountingService.postVoucher({
          companyId: order.companyId, branchId: order.branchId,
          type: refundAccountId ? 'payment' : 'journal',
          narration: refundAccountId ? 'Deposit refund on cancelled custom order' : 'Deposit forfeited on cancelled custom order',
          entries: [
            { accountId: order.depositLiabilityAccountId, debit: order.depositAmount, credit: 0 },
            { accountId: settleAccountId, debit: 0, credit: order.depositAmount },
          ],
          referenceType: 'CustomOrder', referenceId: order._id, userId,
        }, session);
      }
      order.status = 'cancelled';
      await order.save({ session });
    });
    return order;
  } finally {
    session.endSession();
  }
}

function listOrders(companyId, { status, customerId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  return CustomOrder.find(filter).populate('customerId', 'name').sort({ promisedDeliveryDate: 1 });
}

/** Starts real production — a genuine core WorkOrder, not a duplicate concept. */
async function startProduction(customOrderId, { bomId, warehouseId, userId }) {
  const order = await CustomOrder.findById(customOrderId);
  if (!order) throw new Error('Custom order not found.');
  if (order.status !== 'ordered') throw new Error(`Cannot start production for an order with status "${order.status}".`);

  const workOrder = await manufacturingService.createWorkOrder({
    companyId: order.companyId, branchId: order.branchId, warehouseId, bomId, quantityToProduce: 1, userId,
  });

  order.bomId = bomId;
  order.workOrderId = workOrder._id;
  order.status = 'in_production';
  await order.save();
  return order;
}

/** Marks the piece ready for delivery — requires the linked WorkOrder to have actually completed production, not just be in progress. */
async function markReady(customOrderId) {
  const order = await CustomOrder.findById(customOrderId);
  if (!order) throw new Error('Custom order not found.');
  if (order.status !== 'in_production') throw new Error(`Cannot mark ready an order with status "${order.status}".`);
  if (!order.workOrderId) throw new Error('No production has been started for this order.');

  const workOrder = await WorkOrder.findById(order.workOrderId);
  if (!workOrder || workOrder.status !== 'completed') throw new Error('The linked work order has not completed production yet.');

  order.status = 'ready';
  await order.save();
  return order;
}

/**
 * Delivers the piece — bills through the ordinary checkout using the BOM's
 * own finished-goods product (the real thing that was actually produced,
 * not a generic placeholder), applies the deposit the same way Hotel's
 * check-out does, and records actualDeliveryDate for the on-time metric below.
 */
async function deliver(customOrderId, { warehouseId, finalPaymentAccountId, actualDeliveryDate, posTerminalId, userId }) {
  const order = await CustomOrder.findById(customOrderId);
  if (!order) throw new Error('Custom order not found.');
  if (order.status !== 'ready') throw new Error(`Cannot deliver an order with status "${order.status}" — it must be ready first.`);

  const bom = await BillOfMaterials.findById(order.bomId);
  if (!bom) throw new Error('BOM for this order no longer exists.');

  const payments = [];
  const depositApplied = Math.min(order.depositAmount, order.price);
  if (depositApplied > 0) payments.push({ paymentAccountId: order.depositLiabilityAccountId, method: 'advance_applied', amount: depositApplied });
  const remaining = Math.round((order.price - depositApplied) * 100) / 100;
  if (remaining > 0) {
    if (!finalPaymentAccountId) throw new Error(`PKR ${remaining} remains after the deposit — finalPaymentAccountId is required.`);
    payments.push({ paymentAccountId: finalPaymentAccountId, method: 'cash', amount: remaining });
  }

  const sale = await posSaleService.checkout({
    companyId: order.companyId, branchId: order.branchId, warehouseId,
    customerId: order.customerId, posTerminalId, userId,
    items: [{ productId: bom.finishedProductId, variantId: bom.finishedVariantId, quantity: 1, unitPrice: order.price }],
    payments,
  });

  order.status = 'delivered';
  order.actualDeliveryDate = actualDeliveryDate ? new Date(actualDeliveryDate) : new Date();
  order.saleId = sale._id;
  await order.save();

  return { sale, order, wasOnTime: order.actualDeliveryDate <= order.promisedDeliveryDate };
}

/**
 * On-time delivery rate — the genuinely new metric. Every delivered order
 * counts; one delivered exactly ON the promised date counts as on-time
 * (<=, not <), the same "the boundary itself counts" convention Service
 * Station's mileage-due check already used.
 */
async function onTimeDeliveryRate(companyId) {
  const delivered = await CustomOrder.find({ companyId, status: 'delivered' });
  if (delivered.length === 0) return { totalDelivered: 0, onTimeCount: 0, lateCount: 0, onTimeRate: null };

  const onTimeCount = delivered.filter((o) => o.actualDeliveryDate <= o.promisedDeliveryDate).length;
  return {
    totalDelivered: delivered.length, onTimeCount, lateCount: delivered.length - onTimeCount,
    onTimeRate: Math.round((onTimeCount / delivered.length) * 10000) / 100, // percent, 2 decimal places
  };
}

module.exports = { placeOrder, listOrders, updateOrder, cancelOrder, startProduction, markReady, deliver, onTimeDeliveryRate };
