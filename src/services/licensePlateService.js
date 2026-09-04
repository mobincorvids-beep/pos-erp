/**
 * LicensePlateService — pallet/LP-level movement layered on top of
 * BinStock/WarehouseBin, same "additive, never the sole source of truth"
 * posture as warehouseZoneService: StockLevel (inventoryService) stays
 * authoritative for on-hand quantity; BinStock stays the per-bin location
 * breakdown; a LicensePlate is just a named grouping of BinStock rows that
 * all live in the same bin and move together.
 */
const LicensePlate = require('../models/LicensePlate');
const WarehouseBin = require('../models/WarehouseBin');
const warehouseZoneService = require('./warehouseZoneService');

async function generateCode(companyId, warehouseId) {
  const count = await LicensePlate.countDocuments({ companyId, warehouseId });
  return `LP-${String(count + 1).padStart(6, '0')}`;
}

async function createLicensePlate({ companyId, warehouseId, binId, code, createdBy }) {
  const bin = await WarehouseBin.findById(binId);
  if (!bin) throw new Error('Bin not found.');
  if (String(bin.warehouseId) !== String(warehouseId)) throw new Error('Bin does not belong to this warehouse.');

  const plateCode = code || await generateCode(companyId, warehouseId);
  return LicensePlate.create({ companyId, warehouseId, binId, code: plateCode, createdBy });
}

/**
 * Adds (or increases) a product line on the plate, and mirrors that
 * quantity into BinStock at the plate's current bin via
 * warehouseZoneService.adjustBinStock — this is the one place stock
 * actually gets "put on" a pallet, so it's what keeps the plate's contents
 * and the bin's BinStock rows in agreement.
 */
async function addItemToLicensePlate(licensePlateId, { productId, variantId = null, batchId = null, quantity }, session) {
  if (!quantity || quantity <= 0) throw new Error('Quantity must be greater than zero.');
  const plate = await LicensePlate.findById(licensePlateId).session(session || null);
  if (!plate) throw new Error('License plate not found.');
  if (plate.status !== 'open') throw new Error('This license plate is not open for changes.');

  const line = plate.contents.find((c) =>
    String(c.productId) === String(productId) &&
    String(c.variantId || '') === String(variantId || '') &&
    String(c.batchId || '') === String(batchId || '')
  );
  if (line) line.quantity += quantity;
  else plate.contents.push({ productId, variantId, batchId, quantity });
  await plate.save({ session });

  if (plate.binId) {
    await warehouseZoneService.adjustBinStock(
      { binId: plate.binId, productId, quantity, companyId: plate.companyId, warehouseId: plate.warehouseId },
      session
    );
  }
  return plate;
}

/**
 * Moves an entire pallet from its current bin to a new one in one action —
 * every content line's BinStock row is moved with it (decrement at the old
 * bin, increment at the new one), reusing the same clamped adjustBinStock
 * helper recordMovement uses, so a plate can never claim to move more than
 * it actually holds.
 */
async function moveLicensePlate(licensePlateId, toBinId, session) {
  const plate = await LicensePlate.findById(licensePlateId).session(session || null);
  if (!plate) throw new Error('License plate not found.');
  if (plate.status !== 'open' && plate.status !== 'closed') throw new Error('This license plate cannot be moved in its current status.');

  const toBin = await WarehouseBin.findById(toBinId).session(session || null);
  if (!toBin) throw new Error('Destination bin not found.');
  if (String(toBin.warehouseId) !== String(plate.warehouseId)) throw new Error('Cannot move a license plate to a bin in a different warehouse.');

  const fromBinId = plate.binId;
  for (const line of plate.contents) {
    if (fromBinId) {
      await warehouseZoneService.adjustBinStock(
        { binId: fromBinId, productId: line.productId, quantity: -line.quantity, companyId: plate.companyId, warehouseId: plate.warehouseId },
        session
      );
    }
    await warehouseZoneService.adjustBinStock(
      { binId: toBinId, productId: line.productId, quantity: line.quantity, companyId: plate.companyId, warehouseId: plate.warehouseId },
      session
    );
  }

  plate.binId = toBinId;
  await plate.save({ session });
  return plate;
}

async function closeLicensePlate(licensePlateId) {
  return LicensePlate.findByIdAndUpdate(licensePlateId, { status: 'closed', closedAt: new Date() }, { new: true });
}

/** Marks a plate shipped — its contents leave the warehouse as a unit; the actual stock-out StockMovement/BinStock decrement is the caller's responsibility via inventoryService.recordMovement (per-line, same as any other outgoing movement), this just flips the plate's own status/location off the floor. */
async function shipLicensePlate(licensePlateId) {
  const plate = await LicensePlate.findById(licensePlateId);
  if (!plate) throw new Error('License plate not found.');
  for (const line of plate.contents) {
    if (plate.binId) {
      await warehouseZoneService.adjustBinStock({ binId: plate.binId, productId: line.productId, quantity: -line.quantity, companyId: plate.companyId, warehouseId: plate.warehouseId });
    }
  }
  plate.status = 'shipped';
  plate.shippedAt = new Date();
  plate.binId = null;
  return plate.save();
}

async function getLicensePlate(licensePlateId) {
  return LicensePlate.findById(licensePlateId).populate('binId', 'binCode').populate('contents.productId', 'name sku');
}

async function listLicensePlates(companyId, { warehouseId, binId, status } = {}) {
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  if (binId) filter.binId = binId;
  if (status) filter.status = status;
  return LicensePlate.find(filter).populate('binId', 'binCode').sort({ createdAt: -1 });
}

module.exports = {
  createLicensePlate,
  addItemToLicensePlate,
  moveLicensePlate,
  closeLicensePlate,
  shipLicensePlate,
  getLicensePlate,
  listLicensePlates,
};
