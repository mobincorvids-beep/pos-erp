/**
 * BinTransferService — request -> approve -> complete workflow for moving
 * already-located stock from one bin to another within the same warehouse.
 *
 * This is the gated front door onto warehouseZoneService.moveBinStock(),
 * which used to be callable directly with no approval trail at all. The
 * actual stock-location math (including the "not enough stock in the
 * source bin" guard) still lives entirely in moveBinStock() — this service
 * only adds the workflow/audit layer around it and never touches BinStock
 * itself.
 */
const BinTransfer = require('../models/BinTransfer');
const WarehouseBin = require('../models/WarehouseBin');
const BinStock = require('../models/BinStock');
const warehouseZoneService = require('./warehouseZoneService');

/** How much of this product currently sits in the bin — used for the pre-flight check at request/approve time (completeBinTransfer's call into moveBinStock() re-checks it for real at move time). */
async function binQuantity(binId, productId) {
  const row = await BinStock.findOne({ binId, productId });
  return row?.quantity || 0;
}

/**
 * @param {Object} input
 * @param {String} input.companyId
 * @param {String} input.warehouseId
 * @param {String} input.fromBinId
 * @param {String} input.toBinId
 * @param {String} input.productId
 * @param {String} [input.variantId]
 * @param {String} [input.batchId]
 * @param {Number} input.quantity
 * @param {String} input.userId - the requester
 * @param {String} [input.note]
 */
async function requestBinTransfer(input) {
  const {
    companyId, warehouseId, fromBinId, toBinId, productId, variantId, batchId,
    quantity, userId, note,
  } = input;

  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than zero.');
  if (String(fromBinId) === String(toBinId)) throw new Error('Source and destination bins must differ.');

  const [fromBin, toBin] = await Promise.all([
    WarehouseBin.findOne({ _id: fromBinId, companyId }),
    WarehouseBin.findOne({ _id: toBinId, companyId }),
  ]);
  if (!fromBin || !toBin) throw new Error('Bin not found.');
  if (String(fromBin.warehouseId) !== String(warehouseId) || String(toBin.warehouseId) !== String(warehouseId)) {
    throw new Error('Both bins must belong to the given warehouse.');
  }
  if (String(fromBin.warehouseId) !== String(toBin.warehouseId)) {
    throw new Error('Cannot request a bin transfer between different warehouses.');
  }

  // Pre-flight only — a real hold on the source bin's stock isn't taken
  // here (BinStock has no reservation concept), so this is a helpful early
  // error, not the actual guarantee. moveBinStock() re-validates for real
  // at completeBinTransfer() time, right before it moves anything.
  const available = await binQuantity(fromBinId, productId);
  if (available < quantity) {
    throw new Error(`Not enough stock in the source bin to request this transfer (available: ${available}).`);
  }

  return BinTransfer.create({
    companyId, warehouseId, fromBinId, toBinId, productId,
    variantId: variantId || null, batchId: batchId || null, quantity,
    status: 'pending', requestedBy: userId, requestedAt: new Date(), note: note || null,
  });
}

async function approveBinTransfer(id, companyId, userId) {
  const transfer = await BinTransfer.findOne({ _id: id, companyId });
  if (!transfer) throw new Error('Bin transfer not found.');
  if (transfer.status !== 'pending') throw new Error(`Cannot approve a bin transfer with status "${transfer.status}".`);

  // Re-check availability at approval time too — stock may have moved
  // since the request was raised.
  const available = await binQuantity(transfer.fromBinId, transfer.productId);
  if (available < transfer.quantity) {
    throw new Error(`Not enough stock in the source bin to approve this transfer (available: ${available}).`);
  }

  transfer.status = 'approved';
  transfer.approvedBy = userId;
  transfer.approvedAt = new Date();
  await transfer.save();
  return transfer;
}

async function rejectBinTransfer(id, companyId, userId, reason) {
  const transfer = await BinTransfer.findOne({ _id: id, companyId });
  if (!transfer) throw new Error('Bin transfer not found.');
  if (transfer.status !== 'pending' && transfer.status !== 'approved') {
    throw new Error(`Cannot reject a bin transfer with status "${transfer.status}".`);
  }

  transfer.status = 'rejected';
  transfer.rejectedBy = userId;
  transfer.rejectedAt = new Date();
  transfer.rejectionReason = reason || null;
  await transfer.save();
  return transfer;
}

/** Actually moves the stock, by calling the existing moveBinStock() logic — reused, not duplicated. */
async function completeBinTransfer(id, companyId, userId) {
  const transfer = await BinTransfer.findOne({ _id: id, companyId });
  if (!transfer) throw new Error('Bin transfer not found.');
  if (transfer.status !== 'approved') throw new Error(`Cannot complete a bin transfer with status "${transfer.status}" — it must be approved first.`);

  // moveBinStock() itself validates sufficient source-bin stock and throws
  // if there isn't enough — that guard is not re-implemented here.
  await warehouseZoneService.moveBinStock(
    transfer.fromBinId, transfer.toBinId, transfer.productId, transfer.quantity
  );

  transfer.status = 'completed';
  transfer.completedBy = userId;
  transfer.completedAt = new Date();
  await transfer.save();
  return transfer;
}

function listBinTransfers(companyId, { warehouseId, status } = {}) {
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  if (status) filter.status = status;
  return BinTransfer.find(filter).sort({ createdAt: -1 }).limit(200);
}

function getBinTransfer(id, companyId) {
  return BinTransfer.findOne({ _id: id, companyId });
}

module.exports = {
  requestBinTransfer,
  approveBinTransfer,
  rejectBinTransfer,
  completeBinTransfer,
  listBinTransfers,
  getBinTransfer,
};
