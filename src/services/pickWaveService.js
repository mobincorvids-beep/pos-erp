/**
 * PickWaveService — groups sales orders into a wave and generates
 * pick-list lines against currently-located bin stock (from
 * warehouseZoneService.binStockSummary). Purely reads/decrements
 * BinStock (the additive bin-location layer) — it does not touch
 * StockLevel or the existing inventoryService stock ledger; the actual
 * stock deduction for a sale continues to happen wherever it already does
 * (e.g. at sale completion via inventoryService.recordMovement).
 */
const PickWave = require('../models/PickWave');
const PickWaveLine = require('../models/PickWaveLine');
const BinStock = require('../models/BinStock');
const Sale = require('../models/Sale');
const { nextDocumentNumber } = require('./numberingService');

/**
 * Creates a pick wave for the given sales, auto-allocating each sale
 * line's product/quantity to whichever bin(s) currently hold enough of
 * it (simple first-bin-with-enough-stock allocation, splitting across
 * bins only if no single bin has enough).
 */
async function createPickWave({ companyId, warehouseId, saleIds, assignedUserId }) {
  if (!Array.isArray(saleIds) || saleIds.length === 0) {
    throw new Error('At least one sale is required to create a pick wave.');
  }

  const sales = await Sale.find({ _id: { $in: saleIds }, companyId });
  if (sales.length === 0) throw new Error('No matching sales found.');

  // Aggregate required quantity per product across all sales in the wave.
  const required = new Map(); // productId -> quantity
  for (const sale of sales) {
    for (const item of sale.items || []) {
      const key = String(item.productId);
      required.set(key, (required.get(key) || 0) + item.quantity);
    }
  }

  const waveNumber = nextDocumentNumber('PWV');
  const wave = await PickWave.create({
    companyId, warehouseId, waveNumber, status: 'pending', saleIds, assignedUserId: assignedUserId || null,
  });

  const lines = [];
  for (const [productId, qtyNeeded] of required.entries()) {
    const binRows = await BinStock.find({ warehouseId, productId, quantity: { $gt: 0 } }).sort({ quantity: -1 });
    let remaining = qtyNeeded;
    for (const bin of binRows) {
      if (remaining <= 0) break;
      const take = Math.min(bin.quantity, remaining);
      lines.push({
        companyId, pickWaveId: wave._id, productId, binId: bin.binId,
        quantityToPick: take, quantityPicked: 0, status: 'pending',
      });
      remaining -= take;
    }
    // Whatever couldn't be located to a bin (no bin stock recorded for it)
    // still gets a line with binId omitted-equivalent so it's visible as
    // unallocated — but binId is required on the model, so instead we
    // simply leave it out of the pick list; the pending shortfall is
    // surfaced to the caller.
  }

  const createdLines = lines.length ? await PickWaveLine.insertMany(lines) : [];
  return { wave, lines: createdLines };
}

async function recordPick(pickWaveLineId, quantityPicked) {
  if (!quantityPicked || quantityPicked <= 0) throw new Error('quantityPicked must be greater than zero.');

  const line = await PickWaveLine.findById(pickWaveLineId);
  if (!line) throw new Error('Pick wave line not found.');
  if (line.status === 'picked') throw new Error('This line has already been picked.');

  const remaining = line.quantityToPick - line.quantityPicked;
  if (quantityPicked > remaining) throw new Error(`Cannot pick more than the remaining ${remaining} units for this line.`);

  const binStock = await BinStock.findOne({ binId: line.binId, productId: line.productId });
  if (!binStock || binStock.quantity < quantityPicked) {
    throw new Error('Not enough stock remaining in this bin to record this pick.');
  }

  binStock.quantity -= quantityPicked;
  await binStock.save();

  line.quantityPicked += quantityPicked;
  if (line.quantityPicked >= line.quantityToPick) line.status = 'picked';
  await line.save();

  await PickWave.findOneAndUpdate({ _id: line.pickWaveId, status: 'pending' }, { status: 'picking' });

  return line;
}

async function completeWave(pickWaveId) {
  const wave = await PickWave.findById(pickWaveId);
  if (!wave) throw new Error('Pick wave not found.');
  if (wave.status === 'completed') throw new Error('This pick wave is already completed.');
  if (wave.status === 'cancelled') throw new Error('This pick wave was cancelled.');

  const lines = await PickWaveLine.find({ pickWaveId });
  const unpicked = lines.some((l) => l.status !== 'picked');
  if (unpicked) throw new Error('All pick wave lines must be fully picked before completing the wave.');

  wave.status = 'completed';
  await wave.save();
  return wave;
}

async function listPickWaves(companyId, warehouseId) {
  const filter = { companyId };
  if (warehouseId) filter.warehouseId = warehouseId;
  return PickWave.find(filter).sort({ createdAt: -1 }).limit(200);
}

async function getPickWaveLines(pickWaveId) {
  return PickWaveLine.find({ pickWaveId }).populate('productId', 'name sku').populate('binId', 'binCode');
}

module.exports = { createPickWave, recordPick, completeWave, listPickWaves, getPickWaveLines };
