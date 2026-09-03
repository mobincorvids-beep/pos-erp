/**
 * ChangeOrderService — requested changes to a project's scope/budget.
 * A change order starts 'pending'; approving it (approveChangeOrder)
 * applies its signed budgetImpact to Project.budget and logs the
 * adjustment as a ProjectCost('manual') note of zero cost — not a real
 * cost, just an audit trail entry so "why did this project's budget
 * change from X to Y" is answerable from the same place every other cost
 * entry lives, without introducing a second ledger.
 */
const mongoose = require('mongoose');
const ChangeOrder = require('../models/ChangeOrder');
const Project = require('../models/Project');
const ProjectCost = require('../models/ProjectCost');

async function createChangeOrder(input) {
  const { companyId, projectId, description, budgetImpact, requestedBy } = input;
  if (!projectId) throw new Error('projectId is required.');
  if (!description) throw new Error('description is required.');
  if (budgetImpact === undefined || budgetImpact === null || Number.isNaN(Number(budgetImpact))) {
    throw new Error('budgetImpact must be a number.');
  }
  const project = await Project.findOne({ _id: projectId, companyId });
  if (!project) throw new Error('Project not found.');

  return ChangeOrder.create({
    companyId, projectId, description, budgetImpact: Number(budgetImpact), requestedBy: requestedBy || null,
  });
}

function listChangeOrders(companyId, projectId, status) {
  const filter = { companyId };
  if (projectId) filter.projectId = projectId;
  if (status) filter.status = status;
  return ChangeOrder.find(filter).sort({ createdAt: -1 });
}

async function getChangeOrder(companyId, id) {
  const co = await ChangeOrder.findOne({ _id: id, companyId });
  if (!co) throw new Error('Change order not found.');
  return co;
}

async function updateChangeOrder(companyId, id, patch) {
  const co = await getChangeOrder(companyId, id);
  if (co.status !== 'pending') throw new Error('Only pending change orders can be edited.');
  const { description, budgetImpact } = patch;
  if (description !== undefined) co.description = description;
  if (budgetImpact !== undefined) {
    if (Number.isNaN(Number(budgetImpact))) throw new Error('budgetImpact must be a number.');
    co.budgetImpact = Number(budgetImpact);
  }
  await co.save();
  return co;
}

async function deleteChangeOrder(companyId, id) {
  const co = await getChangeOrder(companyId, id);
  if (co.status !== 'pending') throw new Error('Only pending change orders can be deleted.');
  await co.deleteOne();
  return { deleted: true };
}

/**
 * Approving a change order adjusts the project's budget total by
 * budgetImpact (positive or negative) and logs a zero-amount, note-only
 * ProjectCost('manual') entry recording the before/after budget — a
 * lightweight audit trail, not a real cost, so it doesn't distort
 * profitability()'s cost totals.
 */
async function approveChangeOrder(companyId, id, approvedByUserId) {
  const co = await getChangeOrder(companyId, id);
  if (co.status !== 'pending') throw new Error('Only pending change orders can be approved.');

  const project = await Project.findOne({ _id: co.projectId, companyId });
  if (!project) throw new Error('Project not found.');

  const budgetBefore = project.budget;
  project.budget = Math.round((project.budget + co.budgetImpact) * 100) / 100;
  await project.save();

  co.status = 'approved';
  co.approvedBy = approvedByUserId || null;
  co.approvedAt = new Date();
  await co.save();

  await ProjectCost.create({
    companyId, projectId: co.projectId, type: 'manual', amount: 0,
    referenceType: 'ChangeOrder', referenceId: co._id,
    note: `Change order approved: "${co.description}" — budget adjusted ${co.budgetImpact >= 0 ? '+' : ''}${co.budgetImpact} (${budgetBefore} -> ${project.budget})`,
    userId: approvedByUserId || null,
  });

  return { changeOrder: co, project };
}

async function rejectChangeOrder(companyId, id, approvedByUserId, reason) {
  const co = await getChangeOrder(companyId, id);
  if (co.status !== 'pending') throw new Error('Only pending change orders can be rejected.');
  co.status = 'rejected';
  co.approvedBy = approvedByUserId || null;
  co.approvedAt = new Date();
  co.rejectionReason = reason || '';
  await co.save();
  return co;
}

module.exports = {
  createChangeOrder, listChangeOrders, getChangeOrder, updateChangeOrder, deleteChangeOrder,
  approveChangeOrder, rejectChangeOrder,
};
