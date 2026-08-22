/**
 * AgricultureService — startCropCycle() and completeHarvest() are thin
 * wrappers directly calling manufacturingService's real createWorkOrder/
 * startProduction/completeProduction — deliberately NOT reimplementing
 * Manufacturing's cost-per-unit-of-actual-output logic, which already
 * does exactly the right thing. The genuinely new piece is
 * fieldYieldHistory(): a real time-series comparison across every past
 * crop cycle on the SAME field, something no WorkOrder can do on its own
 * since a WorkOrder has no persistent "place" that remembers its own history.
 */
const FarmField = require('../models/FarmField');
const CropCycle = require('../models/CropCycle');
const manufacturingService = require('../../../services/manufacturingService');

function createFarmField(input) {
  const { companyId, branchId, name, areaAcres } = input;
  if (!areaAcres || areaAcres <= 0) throw new Error('areaAcres must be greater than zero.');
  return FarmField.create({ companyId, branchId, name, areaAcres });
}

function listFields(companyId) {
  return FarmField.find({ companyId });
}

/** Planting — genuinely reuses core Manufacturing: a real WorkOrder is created and immediately started (consuming the BOM's raw materials — seeds, fertilizer — right now, the same moment planting actually happens). */
async function startCropCycle(input) {
  const { companyId, branchId, fieldId, bomId, warehouseId, cropName, plantedDate, expectedYield, userId } = input;
  const field = await FarmField.findById(fieldId);
  if (!field) throw new Error('Field not found.');

  const workOrder = await manufacturingService.createWorkOrder({ companyId, branchId, warehouseId, bomId, quantityToProduce: expectedYield, userId });
  await manufacturingService.startProduction(workOrder._id, userId);

  return CropCycle.create({ companyId, fieldId, workOrderId: workOrder._id, cropName, plantedDate, expectedYield });
}

function listCropCycles(companyId, { fieldId, status } = {}) {
  const filter = { companyId };
  if (fieldId) filter.fieldId = fieldId;
  if (status) filter.status = status;
  return CropCycle.find(filter).sort({ plantedDate: -1 });
}

/** Harvest — genuinely reuses core Manufacturing's real costing (total input cost ÷ ACTUAL yield, correctly reflecting that a poor harvest raises the true cost per unit for the same spend). This function's own job is only the field-level bookkeeping on top. */
async function completeHarvest(cropCycleId, { actualYield, actualLaborCost, actualOverheadCost, wastageNote, userId }) {
  const cycle = await CropCycle.findById(cropCycleId);
  if (!cycle) throw new Error('Crop cycle not found.');
  if (cycle.status !== 'growing') throw new Error(`Cannot complete a cycle with status "${cycle.status}".`);

  await manufacturingService.completeProduction(cycle.workOrderId, { quantityProduced: actualYield, actualLaborCost, actualOverheadCost, wastageNote, userId });

  cycle.actualYield = actualYield;
  cycle.yieldVariance = Math.round((actualYield - cycle.expectedYield) * 100) / 100;
  cycle.status = 'harvested';
  await cycle.save();
  return cycle;
}

/**
 * The genuinely new piece: for a field, computes yield-per-acre for every
 * past harvested cycle, the field's historical average EXCLUDING the most
 * recent cycle (comparing the latest harvest against the baseline BEFORE
 * it, not diluted by including itself), and how the latest cycle compares
 * to that baseline as a real percentage.
 */
async function fieldYieldHistory(fieldId) {
  const field = await FarmField.findById(fieldId);
  if (!field) throw new Error('Field not found.');

  const cycles = await CropCycle.find({ fieldId, status: 'harvested' }).sort({ plantedDate: 1 });
  const history = cycles.map((c) => ({
    cropCycleId: c._id, cropName: c.cropName, plantedDate: c.plantedDate,
    actualYield: c.actualYield, yieldPerAcre: Math.round((c.actualYield / field.areaAcres) * 100) / 100,
  }));

  if (history.length === 0) return { fieldId, areaAcres: field.areaAcres, history: [], historicalAverageYieldPerAcre: null, latestVsHistoryPercent: null };

  const latest = history[history.length - 1];
  const priorCycles = history.slice(0, -1);

  let historicalAverageYieldPerAcre = null;
  let latestVsHistoryPercent = null;
  if (priorCycles.length > 0) {
    historicalAverageYieldPerAcre = Math.round((priorCycles.reduce((sum, h) => sum + h.yieldPerAcre, 0) / priorCycles.length) * 100) / 100;
    latestVsHistoryPercent = Math.round(((latest.yieldPerAcre - historicalAverageYieldPerAcre) / historicalAverageYieldPerAcre) * 10000) / 100;
  }

  return { fieldId, areaAcres: field.areaAcres, history, historicalAverageYieldPerAcre, latestVsHistoryPercent };
}

module.exports = { createFarmField, listFields, startCropCycle, listCropCycles, completeHarvest, fieldYieldHistory };
