/**
 * MaintenanceService — internal asset upkeep. Preventive plans on a
 * schedule (frequencyDays/nextDueDate) plus real work orders (planned or
 * ad-hoc breakdown) against a company's own FixedAsset. Distinct from
 * ServiceOrder (a paid job for a customer's item) — nothing here is ever
 * billed to anyone; completion posts a real internal expense voucher
 * instead of a Sale.
 */
const mongoose = require('mongoose');
const MaintenancePlan = require('../models/MaintenancePlan');
const MaintenanceWorkOrder = require('../models/MaintenanceWorkOrder');
const FixedAsset = require('../models/FixedAsset');
const inventoryService = require('./inventoryService');
const accountingService = require('./accountingService');

async function createPlan({ companyId, assetId, name, frequencyDays, nextDueDate, checklist, estimatedCost, createdBy }) {
  const asset = await FixedAsset.findOne({ _id: assetId, companyId });
  if (!asset) throw new Error('Asset not found.');
  if (!frequencyDays || frequencyDays <= 0) throw new Error('frequencyDays must be greater than zero.');
  return MaintenancePlan.create({
    companyId, assetId, name, frequencyDays, nextDueDate: nextDueDate || new Date(),
    checklist: checklist || [], estimatedCost: estimatedCost || 0, createdBy,
  });
}

function listPlans(companyId, { assetId, dueOnly } = {}) {
  const filter = { companyId, isActive: true };
  if (assetId) filter.assetId = assetId;
  if (dueOnly === 'true' || dueOnly === true) filter.nextDueDate = { $lte: new Date() };
  return MaintenancePlan.find(filter).populate('assetId', 'name').sort({ nextDueDate: 1 });
}

/** Corrects a plan's schedule/checklist: safe at any time, nothing downstream snapshots these values except when a work order is actually opened from it. */
async function updatePlan(planId, { name, frequencyDays, nextDueDate, checklist, estimatedCost, isActive }) {
  const plan = await MaintenancePlan.findById(planId);
  if (!plan) throw new Error('Plan not found.');
  if (name !== undefined) plan.name = name;
  if (frequencyDays !== undefined) {
    if (!frequencyDays || frequencyDays <= 0) throw new Error('frequencyDays must be greater than zero.');
    plan.frequencyDays = frequencyDays;
  }
  if (nextDueDate !== undefined) plan.nextDueDate = nextDueDate;
  if (checklist !== undefined) plan.checklist = checklist;
  if (estimatedCost !== undefined) plan.estimatedCost = estimatedCost;
  if (isActive !== undefined) plan.isActive = isActive;
  await plan.save();
  return plan;
}

/** Opens a work order: either against a due plan (carries its checklist/estimate forward) or ad-hoc for a real breakdown. */
async function openWorkOrder({ companyId, branchId, warehouseId, assetId, planId, issue, priority, assignedTechnicianId, userId }) {
  const asset = await FixedAsset.findOne({ _id: assetId, companyId });
  if (!asset) throw new Error('Asset not found.');
  if (planId) {
    const plan = await MaintenancePlan.findOne({ _id: planId, companyId, assetId });
    if (!plan) throw new Error('Maintenance plan not found for this asset.');
  }
  return MaintenanceWorkOrder.create({
    companyId, branchId, warehouseId, assetId, planId: planId || null,
    issue, priority: priority || 'medium', assignedTechnicianId: assignedTechnicianId || null,
    downtimeStart: new Date(), userId,
  });
}

function listWorkOrders(companyId, { assetId, status } = {}) {
  const filter = { companyId };
  if (assetId) filter.assetId = assetId;
  if (status) filter.status = status;
  return MaintenanceWorkOrder.find(filter).populate('assetId', 'name').populate('assignedTechnicianId', 'name').sort({ createdAt: -1 });
}

/**
 * Completes a work order: consumes real stock for any parts used, posts
 * a real expense voucher (Dr expense, Cr cash/payable — caller specifies
 * both accounts, the same "no guessing which account" rule Banquet/
 * Hotel/CarRental cancellations already follow), records downtimeEnd,
 * and — if this work order came from a plan — rolls that plan's
 * nextDueDate forward by frequencyDays so it comes due again on
 * schedule, the same way completing an event doesn't require re-typing
 * the recurrence.
 */
async function completeWorkOrder(workOrderId, { partsUsed, laborCost, expenseAccountId, paymentAccountId, userId }) {
  const session = await mongoose.startSession();
  try {
    let workOrder;
    await session.withTransaction(async () => {
      workOrder = await MaintenanceWorkOrder.findById(workOrderId).session(session);
      if (!workOrder) throw new Error('Work order not found.');
      if (workOrder.status !== 'open' && workOrder.status !== 'in_progress') throw new Error(`Cannot complete a work order with status "${workOrder.status}".`);

      let partsCost = 0;
      if (partsUsed && partsUsed.length) {
        for (const part of partsUsed) {
          await inventoryService.assertSufficientStock(workOrder.warehouseId, part.variantId, null, part.quantity);
          await inventoryService.recordMovement({
            companyId: workOrder.companyId, warehouseId: workOrder.warehouseId,
            productId: part.productId, variantId: part.variantId,
            type: 'adjustment', quantity: -part.quantity, unitCost: part.unitCost,
            referenceType: 'MaintenanceWorkOrder', referenceId: workOrder._id, userId,
            note: 'Parts consumed for maintenance work order',
          }, session);
          partsCost += part.unitCost * part.quantity;
        }
        workOrder.partsUsed = partsUsed;
      }

      workOrder.laborCost = laborCost || 0;
      const totalCost = partsCost + workOrder.laborCost;

      if (totalCost > 0) {
        if (!expenseAccountId || !paymentAccountId) throw new Error('expenseAccountId and paymentAccountId are required when there is a real cost to post.');
        const voucher = await accountingService.postVoucher({
          companyId: workOrder.companyId, branchId: workOrder.branchId, type: 'journal',
          narration: `Maintenance work order: ${workOrder.issue}`,
          entries: [
            { accountId: expenseAccountId, debit: totalCost, credit: 0 },
            { accountId: paymentAccountId, debit: 0, credit: totalCost },
          ],
          referenceType: 'MaintenanceWorkOrder', referenceId: workOrder._id, userId,
        }, session);
        workOrder.voucherId = voucher._id;
      }

      workOrder.status = 'completed';
      workOrder.downtimeEnd = new Date();
      await workOrder.save({ session });

      if (workOrder.planId) {
        const plan = await MaintenancePlan.findById(workOrder.planId).session(session);
        if (plan) {
          const next = new Date(plan.nextDueDate);
          next.setDate(next.getDate() + plan.frequencyDays);
          plan.nextDueDate = next;
          await plan.save({ session });
        }
      }
    });
    return workOrder;
  } finally {
    session.endSession();
  }
}

function cancelWorkOrder(workOrderId) {
  return MaintenanceWorkOrder.findOneAndUpdate(
    { _id: workOrderId, status: { $in: ['open', 'in_progress'] } },
    { $set: { status: 'cancelled', downtimeEnd: new Date() } },
    { new: true }
  );
}

/** Real downtime/cost history for an asset, the data the spec's MTTR/MTBF/downtime-cost reports need. */
async function assetMaintenanceHistory(assetId) {
  const orders = await MaintenanceWorkOrder.find({ assetId, status: 'completed' }).sort({ downtimeStart: 1 });
  const downtimeHours = orders.reduce((sum, o) => {
    if (!o.downtimeStart || !o.downtimeEnd) return sum;
    return sum + (o.downtimeEnd - o.downtimeStart) / (1000 * 60 * 60);
  }, 0);
  const totalCost = orders.reduce((sum, o) => {
    const partsCost = (o.partsUsed || []).reduce((s, p) => s + p.unitCost * p.quantity, 0);
    return sum + partsCost + (o.laborCost || 0);
  }, 0);
  return { assetId, completedWorkOrders: orders.length, totalDowntimeHours: Math.round(downtimeHours * 100) / 100, totalCost, orders };
}

module.exports = { createPlan, listPlans, updatePlan, openWorkOrder, listWorkOrders, completeWorkOrder, cancelWorkOrder, assetMaintenanceHistory };
