/**
 * SubcontractService — job-work / subcontracting tracking. Goods sent out to
 * a third-party subcontractor (e.g. raw fabric out for dyeing) and tracked
 * until finished/semi-finished goods come back, possibly in a different
 * quantity than sent (wastage/shrinkage at the subcontractor's end).
 *
 * Deliberately does not post stock movements — unlike a StockTransfer
 * between the company's own warehouses, subcontracted goods leaving the
 * building is a business event this app tracks for visibility (what's out,
 * with whom, since when, at what job-work cost) without redefining what
 * "on hand" means for InventoryService. A company wanting stock to also
 * move can pair this with a manual adjustment/transfer.
 */
const SubcontractOrder = require('../models/SubcontractOrder');
const auditService = require('./auditService');
const { nextDocumentNumber } = require('./numberingService');

async function createOrder(input) {
  const {
    companyId, branchId, warehouseId, supplierId, workOrderId,
    itemsSent, sentDate, expectedReturnDate, subcontractingCost, note, userId,
  } = input;

  if (!itemsSent || itemsSent.length === 0) throw new Error('At least one item sent is required.');
  if (!supplierId) throw new Error('supplierId is required.');

  const order = await SubcontractOrder.create({
    companyId, branchId, warehouseId, supplierId, workOrderId: workOrderId || null,
    orderNumber: nextDocumentNumber('SUB'),
    itemsSent, itemsReceived: [],
    sentDate: sentDate || new Date(),
    expectedReturnDate: expectedReturnDate || null,
    subcontractingCost: subcontractingCost || 0,
    status: 'sent', note, userId,
  });

  await auditService.record({
    companyId, userId, action: 'subcontract_order.created',
    entityType: 'SubcontractOrder', entityId: order._id,
  });

  return order;
}

function listOrders(companyId, { status, supplierId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (supplierId) filter.supplierId = supplierId;
  return SubcontractOrder.find(filter).sort({ createdAt: -1 }).limit(200);
}

async function getOrder(companyId, id) {
  const order = await SubcontractOrder.findOne({ _id: id, companyId });
  if (!order) throw new Error('Subcontract order not found.');
  return order;
}

/**
 * Records goods received back from the subcontractor — additive: each call
 * ADDS to itemsReceived (a partial return followed by another partial
 * return, rather than one call replacing the list), so status can honestly
 * distinguish "partially_received" from "received" across multiple trips.
 * Quantity received need not match quantity sent (wastage at the
 * subcontractor is expected and NOT an error).
 */
async function receiveItems(companyId, id, { items, actualReturnDate, subcontractingCost, userId }) {
  if (!items || items.length === 0) throw new Error('At least one received item is required.');

  const order = await SubcontractOrder.findOne({ _id: id, companyId });
  if (!order) throw new Error('Subcontract order not found.');
  if (order.status === 'closed') throw new Error('This subcontract order is closed.');

  for (const item of items) {
    const existing = order.itemsReceived.find(
      (r) => String(r.productId) === String(item.productId) && String(r.variantId) === String(item.variantId)
    );
    if (existing) existing.quantity += Number(item.quantity);
    else order.itemsReceived.push({ productId: item.productId, variantId: item.variantId, quantity: Number(item.quantity) });
  }

  if (subcontractingCost !== undefined && subcontractingCost !== null) order.subcontractingCost = subcontractingCost;

  // "Fully received" is judged per-line against itemsSent: every sent line's
  // total received quantity must be at least what was sent to call it done.
  // Wastage means it may never fully reach that bar — closeOrder() is how an
  // operator settles that case explicitly rather than the status looping forever.
  const receivedByKey = new Map(order.itemsReceived.map((r) => [`${r.productId}|${r.variantId}`, r.quantity]));
  const fullyReceived = order.itemsSent.every((s) => (receivedByKey.get(`${s.productId}|${s.variantId}`) || 0) >= s.quantity);

  order.status = fullyReceived ? 'received' : 'partially_received';
  if (fullyReceived) order.actualReturnDate = actualReturnDate || new Date();

  await order.save();

  await auditService.record({
    companyId, userId, action: 'subcontract_order.received',
    entityType: 'SubcontractOrder', entityId: order._id, metadata: { items },
  });

  return order;
}

/** Explicitly settles an order that will never fully reconcile against itemsSent (accepted wastage) or is otherwise done. */
async function closeOrder(companyId, id, { userId } = {}) {
  const order = await SubcontractOrder.findOne({ _id: id, companyId });
  if (!order) throw new Error('Subcontract order not found.');
  order.status = 'closed';
  if (!order.actualReturnDate) order.actualReturnDate = new Date();
  await order.save();

  await auditService.record({
    companyId, userId, action: 'subcontract_order.closed',
    entityType: 'SubcontractOrder', entityId: order._id,
  });

  return order;
}

module.exports = { createOrder, listOrders, getOrder, receiveItems, closeOrder };
