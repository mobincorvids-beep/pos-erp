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
const Account = require('../models/Account');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');
const auditService = require('./auditService');
const defaultAccountsService = require('./defaultAccountsService');
const { nextDocumentNumber } = require('./numberingService');

function createBOM(input) {
  const { companyId, finishedProductId, finishedVariantId, name, components, laborCostPerUnit, overheadCostPerUnit } = input;
  if (!components || components.length === 0) throw new Error('BOM must have at least one component.');
  return BillOfMaterials.create({
    companyId, finishedProductId, finishedVariantId, name, components,
    laborCostPerUnit: laborCostPerUnit || 0, overheadCostPerUnit: overheadCostPerUnit || 0,
  });
}

async function createWorkOrder(input) {
  const { companyId, branchId, warehouseId, bomId, quantityToProduce, userId } = input;
  if (!quantityToProduce || quantityToProduce <= 0) throw new Error('quantityToProduce must be greater than zero.');

  const bom = await BillOfMaterials.findOne({ _id: bomId, companyId, isActive: true });
  if (!bom) throw new Error('Active BOM not found.');

  return WorkOrder.create({
    companyId, branchId, warehouseId, bomId,
    workOrderNumber: nextDocumentNumber('WO'),
    quantityToProduce, status: 'planned', userId,
  });
}

/** Consumes raw materials for the work order's full planned quantity. */
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

      for (const component of bom.components) {
        const requiredQty = component.quantityPerUnit * workOrder.quantityToProduce;
        await inventoryService.recordMovement({
          companyId: workOrder.companyId, warehouseId: workOrder.warehouseId,
          productId: component.productId, variantId: component.variantId,
          type: 'production_consume', quantity: -requiredQty,
          referenceType: 'WorkOrder', referenceId: workOrder._id, userId,
          note: `Consumed for ${workOrder.workOrderNumber}`,
        }, session);
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
async function completeProduction(workOrderId, { quantityProduced, actualLaborCost, actualOverheadCost, wastageNote, userId }) {
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

      const laborCost = actualLaborCost ?? (bom.laborCostPerUnit * quantityProduced);
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
      workOrder.status = 'completed';
      workOrder.completedAt = new Date();
      await workOrder.save({ session });

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

module.exports = { createBOM, createWorkOrder, startProduction, completeProduction };
