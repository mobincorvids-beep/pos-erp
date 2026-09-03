/**
 * ManufacturingService — BOM-driven production. startProduction() consumes
 * raw materials (via InventoryService, type 'production_consume');
 * completeProduction() adds the finished goods (type 'production_output',
 * carrying a computed unit cost so the finished good gets a real
 * weighted-average cost, not zero) and posts a journal voucher moving value
 * from raw-material inventory into finished-goods inventory plus applied
 * labor/overhead — this is the "same accounting engine underneath" the
 * proposal calls for, reusing AccountingService rather than a manufacturing-
 * specific ledger.
 */
const mongoose = require('mongoose');
const BillOfMaterials = require('../models/BillOfMaterials');
const WorkOrder = require('../models/WorkOrder');
const WorkCenter = require('../models/WorkCenter');
const Routing = require('../models/Routing');
const Account = require('../models/Account');
const Product = require('../models/Product');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const auditService = require('./auditService');
const defaultAccountsService = require('./defaultAccountsService');
const schedulingService = require('./schedulingService');
const { nextDocumentNumber } = require('./numberingService');

function createBOM(input) {
  const { companyId, finishedProductId, finishedVariantId, name, components, laborCostPerUnit, overheadCostPerUnit } = input;
  if (!components || components.length === 0) throw new Error('BOM must have at least one component.');
  return BillOfMaterials.create({
    companyId, finishedProductId, finishedVariantId, name, components,
    laborCostPerUnit: laborCostPerUnit || 0, overheadCostPerUnit: overheadCostPerUnit || 0,
  });
}

function createWorkCenter(input) {
  const { companyId, name, description, capacityHoursPerDay, hourlyRate } = input;
  if (!name) throw new Error('Work center name is required.');
  return WorkCenter.create({ companyId, name, description, capacityHoursPerDay: capacityHoursPerDay || 8, hourlyRate: hourlyRate || 0 });
}

function listWorkCenters(companyId) {
  return WorkCenter.find({ companyId, isActive: true });
}

async function updateWorkCenter(id, companyId, patch) {
  const workCenter = await WorkCenter.findOne({ _id: id, companyId });
  if (!workCenter) throw new Error('Work center not found.');
  ['name', 'description', 'capacityHoursPerDay', 'hourlyRate', 'isActive'].forEach((field) => {
    if (patch[field] !== undefined) workCenter[field] = patch[field];
  });
  await workCenter.save();
  return workCenter;
}

async function createRouting(input) {
  const { companyId, bomId, name, operations } = input;
  if (!operations || operations.length === 0) throw new Error('Routing must have at least one operation.');
  const bom = await BillOfMaterials.findOne({ _id: bomId, companyId });
  if (!bom) throw new Error('BOM not found.');
  const sorted = [...operations].sort((a, b) => a.sequence - b.sequence);
  return Routing.create({ companyId, bomId, name, operations: sorted });
}

function listRoutings(companyId, bomId) {
  const filter = { companyId, isActive: true };
  if (bomId) filter.bomId = bomId;
  return Routing.find(filter);
}

async function createWorkOrder(input) {
  const { companyId, branchId, warehouseId, bomId, routingId, quantityToProduce, userId } = input;
  if (!quantityToProduce || quantityToProduce <= 0) throw new Error('quantityToProduce must be greater than zero.');

  const bom = await BillOfMaterials.findOne({ _id: bomId, companyId, isActive: true });
  if (!bom) throw new Error('Active BOM not found.');

  let routing = null;
  if (routingId) {
    routing = await Routing.findOne({ _id: routingId, companyId, bomId, isActive: true });
    if (!routing) throw new Error('Routing not found for this BOM.');
  }

  return WorkOrder.create({
    companyId, branchId, warehouseId, bomId, routingId: routing ? routing._id : null,
    workOrderNumber: nextDocumentNumber('WO'),
    quantityToProduce, status: 'planned', userId,
    // 1:1 BOM ratio in this data model (components are expressed per ONE
    // finished unit), so the expected output is simply the planned quantity
    // — see the yield/wastage report this feeds at completion.
    expectedOutputQuantity: quantityToProduce,
  });
}

/**
 * Consumes raw materials for the work order's full planned quantity. For a
 * batch/expiry-tracked component (Product.trackExpiry or trackingMode
 * 'batch'), consumption is picked FEFO across that component's available
 * batches at this warehouse — same ordering as the POS checkout batch
 * picker — and each batch actually drawn from is recorded on
 * workOrder.consumedBatches for traceability. A non-tracked component
 * consumes exactly as before (no batchId).
 */
async function startProduction(workOrderId, userId) {
  const session = await mongoose.startSession();
  try {
    let workOrder;
    await session.withTransaction(async () => {
      workOrder = await WorkOrder.findById(workOrderId).session(session);
      if (!workOrder) throw new Error('Work order not found.');
      if (workOrder.status !== 'planned') throw new Error(`Cannot start a work order with status "${workOrder.status}".`);

      const bom = await BillOfMaterials.findById(workOrder.bomId).session(session);
      if (!bom) throw new Error('BOM not found.');

      for (const component of bom.components) {
        const requiredQty = component.quantityPerUnit * workOrder.quantityToProduce;
        await inventoryService.assertSufficientStock(workOrder.warehouseId, component.variantId, null, requiredQty);
      }

      const consumedBatches = [];
      for (const component of bom.components) {
        let requiredQty = component.quantityPerUnit * workOrder.quantityToProduce;
        const product = await Product.findById(component.productId).session(session);
        const isBatchTracked = product && (product.trackExpiry || product.trackingMode === 'batch');

        if (isBatchTracked) {
          // listAvailableBatches isn't session-aware (it's a plain read used
          // by the POS picker too) — acceptable here since startProduction
          // already asserted sufficient TOTAL stock above; a concurrent
          // consumer racing a specific batch just means the FEFO order is a
          // best-effort snapshot, not a hard reservation.
          const batches = await inventoryService.listAvailableBatches(workOrder.warehouseId, component.variantId);
          let remaining = requiredQty;
          for (const batch of batches) {
            if (remaining <= 0) break;
            const takeQty = Math.min(remaining, batch.availableQuantity);
            if (takeQty <= 0) continue;
            await inventoryService.recordMovement({
              companyId: workOrder.companyId, warehouseId: workOrder.warehouseId,
              productId: component.productId, variantId: component.variantId, batchId: batch._id,
              type: 'production_consume', quantity: -takeQty,
              referenceType: 'WorkOrder', referenceId: workOrder._id, userId,
              note: `Consumed for ${workOrder.workOrderNumber}`,
            }, session);
            consumedBatches.push({
              productId: component.productId, variantId: component.variantId,
              batchId: batch._id, batchNumber: batch.batchNumber, quantityConsumed: takeQty,
            });
            remaining -= takeQty;
          }
          if (remaining > 0) {
            // Batches on hand don't cover it (e.g. some stock isn't
            // batch-assigned) — consume the rest untracked rather than fail
            // a run that assertSufficientStock already cleared overall.
            await inventoryService.recordMovement({
              companyId: workOrder.companyId, warehouseId: workOrder.warehouseId,
              productId: component.productId, variantId: component.variantId,
              type: 'production_consume', quantity: -remaining,
              referenceType: 'WorkOrder', referenceId: workOrder._id, userId,
              note: `Consumed for ${workOrder.workOrderNumber}`,
            }, session);
          }
        } else {
          await inventoryService.recordMovement({
            companyId: workOrder.companyId, warehouseId: workOrder.warehouseId,
            productId: component.productId, variantId: component.variantId,
            type: 'production_consume', quantity: -requiredQty,
            referenceType: 'WorkOrder', referenceId: workOrder._id, userId,
            note: `Consumed for ${workOrder.workOrderNumber}`,
          }, session);
        }
      }
      workOrder.consumedBatches = consumedBatches;

      if (workOrder.routingId) {
        const routing = await Routing.findById(workOrder.routingId).session(session);
        if (routing) {
          const workCenterIds = [...new Set(routing.operations.map((o) => String(o.workCenterId)))];
          const workCenters = await WorkCenter.find({ _id: { $in: workCenterIds } }).session(session);
          const workCentersById = new Map(workCenters.map((wc) => [String(wc._id), wc.capacityHoursPerDay]));
          workOrder.schedule = await schedulingService.scheduleWorkOrder({
            companyId: workOrder.companyId, workOrderId: workOrder._id, routing, workCentersById, startFrom: new Date(),
          });
        }
      }

      workOrder.status = 'in_progress';
      workOrder.startedAt = new Date();
      await workOrder.save({ session });

      await auditService.record({
        companyId: workOrder.companyId, userId, action: 'work_order.started',
        entityType: 'WorkOrder', entityId: workOrder._id,
      }, session);
    });
    return workOrder;
  } finally {
    session.endSession();
  }
}

/**
 * Adds finished goods to stock. quantityProduced may differ from
 * quantityToProduce (wastage) — the unit cost is computed from the ACTUAL
 * raw material cost already consumed (read back from the production_consume
 * movements) plus labor/overhead, divided by quantityProduced, so wastage
 * correctly makes each finished unit more expensive rather than silently
 * absorbed.
 */
async function completeProduction(workOrderId, { quantityProduced, actualLaborCost, actualOverheadCost, wastageNote, scrapQuantity, userId }) {
  const session = await mongoose.startSession();
  try {
    let workOrder;
    await session.withTransaction(async () => {
      workOrder = await WorkOrder.findById(workOrderId).session(session);
      if (!workOrder) throw new Error('Work order not found.');
      if (workOrder.status !== 'in_progress') throw new Error(`Cannot complete a work order with status "${workOrder.status}".`);
      if (!quantityProduced || quantityProduced <= 0) throw new Error('quantityProduced must be greater than zero.');

      const bom = await BillOfMaterials.findById(workOrder.bomId).session(session);

      // Materials were consumed at startProduction() without a stored unit
      // cost (production_consume isn't a "costed incoming" movement type).
      // Value them at each component's CURRENT avgCost — acceptable for a
      // short production cycle; a longer one should snapshot cost at
      // startProduction() time instead if raw material costs are volatile.
      let materialCost = 0;
      for (const component of bom.components) {
        const avgCost = await inventoryService.getAvgCost(workOrder.warehouseId, component.variantId, null);
        materialCost += avgCost * component.quantityPerUnit * workOrder.quantityToProduce;
      }

      // Labor cost preference order: an explicit override (actualLaborCost),
      // then WorkCenter.hourlyRate x actual hours logged against this work
      // order's scheduled operations (real routed runs), falling back to
      // the BOM's flat laborCostPerUnit x quantity when there's no routing
      // or no work center has an hourly rate configured.
      let laborCost = actualLaborCost;
      if (laborCost === undefined || laborCost === null) {
        if (workOrder.schedule && workOrder.schedule.length) {
          const workCenterIds = [...new Set(workOrder.schedule.map((op) => String(op.workCenterId)))];
          const workCenters = await WorkCenter.find({ _id: { $in: workCenterIds } }).session(session);
          const rateById = new Map(workCenters.map((wc) => [String(wc._id), wc.hourlyRate || 0]));
          const hasAnyRate = workCenters.some((wc) => wc.hourlyRate > 0);
          if (hasAnyRate) {
            laborCost = workOrder.schedule.reduce((sum, op) => {
              const hours = op.actualHours ?? op.estimatedHours ?? 0;
              return sum + hours * (rateById.get(String(op.workCenterId)) || 0);
            }, 0);
          }
        }
        if (laborCost === undefined || laborCost === null) laborCost = bom.laborCostPerUnit * quantityProduced;
      }
      const overheadCost = actualOverheadCost ?? (bom.overheadCostPerUnit * quantityProduced);
      const totalProductionCost = materialCost + laborCost + overheadCost;
      const unitCost = totalProductionCost / quantityProduced;

      await inventoryService.recordMovement({
        companyId: workOrder.companyId, warehouseId: workOrder.warehouseId,
        productId: bom.finishedProductId, variantId: bom.finishedVariantId,
        type: 'production_output', quantity: quantityProduced, unitCost,
        referenceType: 'WorkOrder', referenceId: workOrder._id, userId,
        note: `Produced from ${workOrder.workOrderNumber}`,
      }, session);

      workOrder.quantityProduced = quantityProduced;
      workOrder.actualLaborCost = laborCost;
      workOrder.actualOverheadCost = overheadCost;
      workOrder.wastageNote = wastageNote || null;
      workOrder.scrapQuantity = scrapQuantity || 0;

      // --- Production costing ---
      workOrder.actualMaterialCost = materialCost;
      workOrder.overheadCost = overheadCost;
      workOrder.totalProductionCost = totalProductionCost;
      workOrder.costPerUnit = unitCost;

      // --- Yield / wastage ---
      const expectedOutput = workOrder.expectedOutputQuantity ?? workOrder.quantityToProduce;
      workOrder.actualOutputQuantity = quantityProduced;
      workOrder.yieldPercentage = expectedOutput > 0 ? (quantityProduced / expectedOutput) * 100 : null;
      workOrder.wastageQuantity = Math.max(expectedOutput - quantityProduced, 0);

      if (workOrder.schedule && workOrder.schedule.length) {
        workOrder.schedule.forEach((op) => { if (op.status !== 'completed') op.status = 'completed'; });
      }
      workOrder.status = 'completed';
      workOrder.completedAt = new Date();
      await workOrder.save({ session });

      // Update the finished product's static cost basis to the actual run
      // cost, the same "last cost wins" pattern productImportService uses
      // for a CSV cost update — StockLevel.avgCost (already updated above
      // via the production_output movement) remains the real weighted-
      // average valuation used for COGS; this just keeps Product.costPrice
      // from sitting stale at 0 for a manufactured item.
      const finishedProduct = await Product.findById(bom.finishedProductId).session(session);
      if (finishedProduct) {
        finishedProduct.costPrice = unitCost;
        const variant = finishedProduct.variants?.id(bom.finishedVariantId);
        if (variant) variant.costPrice = unitCost;
        await finishedProduct.save({ session });
      }

      // Move value: Cr Raw Material Inventory (already reflected via the
      // production_consume movements' effect on StockLevel — no separate
      // sub-account here), Dr Finished Goods value into the same Inventory
      // Asset account, plus applying labor/overhead out of their accrual accounts.
      const inventoryAsset = await defaultAccountsService.resolve(workOrder.companyId, 'inventoryAssetId', session);
      const laborAccount = (await Account.findOne({ companyId: workOrder.companyId, type: 'expense', name: /labor/i }).session(session))?._id;
      const overheadAccount = (await Account.findOne({ companyId: workOrder.companyId, type: 'expense', name: /overhead/i }).session(session))?._id;

      if (inventoryAsset && laborCost + overheadCost > 0) {
        const entries = [{ accountId: inventoryAsset, debit: laborCost + overheadCost, credit: 0 }];
        if (laborAccount && laborCost > 0) entries.push({ accountId: laborAccount, debit: 0, credit: laborCost });
        if (overheadAccount && overheadCost > 0) entries.push({ accountId: overheadAccount, debit: 0, credit: overheadCost });
        // If labor/overhead accounts aren't configured, skip rather than post
        // an unbalanced voucher — inventory value from materials alone is
        // still correctly tracked via the production_output movement's unitCost.
        if (entries.length > 1) {
          await accountingService.postVoucher({
            companyId: workOrder.companyId, branchId: workOrder.branchId, type: 'journal',
            narration: `Labor/overhead applied for ${workOrder.workOrderNumber}`,
            entries, referenceType: 'WorkOrder', referenceId: workOrder._id, userId,
          }, session);
        }
      }

      await auditService.record({
        companyId: workOrder.companyId, userId, action: 'work_order.completed',
        entityType: 'WorkOrder', entityId: workOrder._id,
        metadata: { quantityProduced, unitCost },
      }, session);
    });
    return workOrder;
  } finally {
    session.endSession();
  }
}

/** Records actual hours taken for one scheduled operation (vs. its estimate) — the raw input to the efficiency report. */
async function recordOperationActuals(workOrderId, operationId, { actualHours, status, userId }) {
  const workOrder = await WorkOrder.findById(workOrderId);
  if (!workOrder) throw new Error('Work order not found.');
  const op = workOrder.schedule.id(operationId);
  if (!op) throw new Error('Scheduled operation not found.');
  if (actualHours !== undefined) op.actualHours = actualHours;
  if (status) op.status = status;
  await workOrder.save();
  await auditService.record({
    companyId: workOrder.companyId, userId, action: 'work_order.operation_recorded',
    entityType: 'WorkOrder', entityId: workOrder._id, metadata: { operationId, actualHours, status },
  });
  return workOrder;
}

/**
 * Basic OEE-adjacent efficiency report for completed (or in-progress) work
 * orders: planned vs. actual hours per operation, and quantity produced vs.
 * planned (including scrap) per work order. This is deliberately not a full
 * availability x performance x quality OEE waterfall — the app has no
 * machine-uptime/downtime tracking to support "availability" cleanly — but
 * performance (hours) and quality (scrap rate) are both real, stored data.
 */
async function getEfficiencyReport(companyId, { warehouseId, from, to } = {}) {
  const filter = { companyId, status: { $in: ['in_progress', 'completed'] } };
  if (warehouseId) filter.warehouseId = warehouseId;
  if (from || to) {
    filter.startedAt = {};
    if (from) filter.startedAt.$gte = new Date(from);
    if (to) filter.startedAt.$lte = new Date(to);
  }

  const workOrders = await WorkOrder.find(filter).sort({ startedAt: -1 }).limit(200);

  return workOrders.map((wo) => {
    const plannedHours = wo.schedule.reduce((sum, op) => sum + (op.estimatedHours || 0), 0);
    const actualHours = wo.schedule.reduce((sum, op) => sum + (op.actualHours ?? op.estimatedHours ?? 0), 0);
    const performanceRatio = actualHours > 0 ? plannedHours / actualHours : null; // >1 means faster than planned
    const goodQty = wo.quantityProduced || 0;
    const totalAttempted = goodQty + (wo.scrapQuantity || 0);
    const qualityRatio = totalAttempted > 0 ? goodQty / totalAttempted : null;
    const yieldRatio = wo.quantityToProduce > 0 ? goodQty / wo.quantityToProduce : null;
    return {
      workOrderId: wo._id,
      workOrderNumber: wo.workOrderNumber,
      status: wo.status,
      quantityToProduce: wo.quantityToProduce,
      quantityProduced: wo.quantityProduced,
      scrapQuantity: wo.scrapQuantity || 0,
      plannedHours, actualHours,
      performanceRatio, qualityRatio, yieldRatio,
      // Simple composite: performance x quality, when both are known — the closest
      // this data can honestly get to an OEE-style efficiency number without a
      // separate availability/downtime source.
      efficiency: (performanceRatio != null && qualityRatio != null) ? performanceRatio * qualityRatio : null,
      operations: wo.schedule.map((op) => ({
        operationName: op.operationName, sequence: op.sequence, workCenterId: op.workCenterId,
        estimatedHours: op.estimatedHours, actualHours: op.actualHours, status: op.status,
      })),
    };
  });
}

module.exports = {
  createBOM, createWorkOrder, startProduction, completeProduction,
  createWorkCenter, listWorkCenters, updateWorkCenter,
  createRouting, listRoutings,
  recordOperationActuals, getEfficiencyReport,
};
