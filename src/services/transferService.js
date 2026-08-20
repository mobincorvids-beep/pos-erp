/**
 * TransferService — moves stock between warehouses using the same two
 * InventoryService calls (transfer_out at source, transfer_in at destination)
 * so the movement ledger always shows both legs of the transfer, not a
 * single opaque "moved" event.
 *
 * Modeled as two steps (initiate/receive) rather than one atomic call,
 * because in real operations goods are in transit between the two — stock
 * leaves the source warehouse before it's confirmed received at the
 * destination. Use initiateTransfer() + receiveTransfer() for that flow;
 * pass `receiveImmediately: true` to do both atomically for same-site transfers.
 */
const mongoose = require('mongoose');
const StockTransfer = require('../models/StockTransfer');
const inventoryService = require('./inventoryService');

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} input.fromWarehouseId
 * @param {String} input.toWarehouseId
 * @param {Array} input.items - [{ productId, variantId, batchId?, quantity }]
 * @param {String} [input.userId]
 * @param {Boolean} [input.receiveImmediately]
 */
async function initiateTransfer(input) {
  const session = await mongoose.startSession();
  try {
    let transfer;

    await session.withTransaction(async () => {
      const {
        companyId, fromWarehouseId, toWarehouseId, items, userId, receiveImmediately,
      } = input;

      if (fromWarehouseId === toWarehouseId) {
        throw new Error('Source and destination warehouse must be different.');
      }
      if (!items || items.length === 0) {
        throw new Error('Transfer must contain at least one item.');
      }

      for (const item of items) {
        await inventoryService.assertSufficientStock(
          fromWarehouseId, item.variantId, item.batchId || null, item.quantity
        );
      }

      [transfer] = await StockTransfer.create(
        [{
          companyId, fromWarehouseId, toWarehouseId,
          status: receiveImmediately ? 'received' : 'in_transit',
          items: items.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            batchId: i.batchId || null,
            quantity: i.quantity,
          })),
          userId,
        }],
        { session }
      );

      // Leg 1: deduct from source immediately — goods have physically left.
      for (const item of items) {
        await inventoryService.recordMovement({
          companyId, warehouseId: fromWarehouseId,
          productId: item.productId, variantId: item.variantId, batchId: item.batchId || null,
          type: 'transfer_out', quantity: -item.quantity,
          referenceType: 'StockTransfer', referenceId: transfer._id, userId,
          note: `Transfer ${transfer._id} to warehouse ${toWarehouseId}`,
        }, session);
      }

      if (receiveImmediately) {
        for (const item of items) {
          await inventoryService.recordMovement({
            companyId, warehouseId: toWarehouseId,
            productId: item.productId, variantId: item.variantId, batchId: item.batchId || null,
            type: 'transfer_in', quantity: item.quantity,
            referenceType: 'StockTransfer', referenceId: transfer._id, userId,
            note: `Transfer ${transfer._id} from warehouse ${fromWarehouseId}`,
          }, session);
        }
      }
    });

    return transfer;
  } finally {
    session.endSession();
  }
}

/** Leg 2: confirm goods arrived at the destination warehouse. */
async function receiveTransfer(transferId, userId) {
  const session = await mongoose.startSession();
  try {
    let transfer;

    await session.withTransaction(async () => {
      transfer = await StockTransfer.findById(transferId).session(session);
      if (!transfer) throw new Error('Stock transfer not found.');
      if (transfer.status === 'received') throw new Error('Transfer already received.');

      for (const item of transfer.items) {
        await inventoryService.recordMovement({
          companyId: transfer.companyId, warehouseId: transfer.toWarehouseId,
          productId: item.productId, variantId: item.variantId, batchId: item.batchId || null,
          type: 'transfer_in', quantity: item.quantity,
          referenceType: 'StockTransfer', referenceId: transfer._id, userId,
          note: `Transfer ${transfer._id} received from warehouse ${transfer.fromWarehouseId}`,
        }, session);
      }

      transfer.status = 'received';
      await transfer.save({ session });
    });

    return transfer;
  } finally {
    session.endSession();
  }
}

module.exports = { initiateTransfer, receiveTransfer };
