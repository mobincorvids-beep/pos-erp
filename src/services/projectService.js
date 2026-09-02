/**
 * ProjectService — projects and job costing. Costs mostly arrive here
 * automatically (see expenseService.approveExpense and
 * purchaseService.receiveGoods, both of which create a ProjectCost when
 * their document is tagged with a projectId) — this service is mainly the
 * read side (profitability) plus manual cost entry for costs that have no
 * other source document (e.g. an internal labor allocation).
 */
const mongoose = require('mongoose');
const Project = require('../models/Project');
const ProjectCost = require('../models/ProjectCost');
const ProjectDoc = require('../models/ProjectDoc');
const Sale = require('../models/Sale');
const { nextDocumentNumber } = require('./numberingService');

function createProject(input) {
  const { companyId, customerId, name, budget, managerUserId, startDate, endDate } = input;
  if (!name) throw new Error('Project name is required.');
  return Project.create({
    companyId, customerId, name, budget: budget || 0, managerUserId, startDate, endDate,
    code: nextDocumentNumber('PRJ'),
  });
}

async function updateStatus(projectId, status) {
  const valid = ['planned', 'in_progress', 'completed', 'cancelled'];
  if (!valid.includes(status)) throw new Error(`Invalid status "${status}".`);
  const project = await Project.findByIdAndUpdate(projectId, { status }, { new: true });
  if (!project) throw new Error('Project not found.');
  return project;
}

/** Manual cost entry: for costs with no Expense/PurchaseOrder of their own (e.g. internal labor). Auto-created costs (type expense/material) come from elsewhere and shouldn't be entered here too. */
function logManualCost(input) {
  const { companyId, projectId, amount, note, date, userId } = input;
  if (!amount || amount <= 0) throw new Error('Cost amount must be greater than zero.');
  return ProjectCost.create({ companyId, projectId, type: 'manual', amount, note, date: date || new Date(), userId });
}

/**
 * Profitability: revenue is every completed Sale tagged with this project;
 * cost is every ProjectCost (auto + manual) tagged with it. Reads two
 * collections that other modules already write to — no separate
 * "project ledger" to keep in sync.
 */
async function profitability(projectId) {
  const project = await Project.findById(projectId);
  if (!project) throw new Error('Project not found.');

  const [revenueAgg, costsByType] = await Promise.all([
    Sale.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId), status: 'completed' } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, invoiceCount: { $sum: 1 } } },
    ]),
    ProjectCost.aggregate([
      { $match: { projectId: new mongoose.Types.ObjectId(projectId) } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
  ]);

  const revenue = revenueAgg[0]?.revenue || 0;
  const invoiceCount = revenueAgg[0]?.invoiceCount || 0;
  const costBreakdown = Object.fromEntries(costsByType.map((c) => [c._id, Math.round(c.total * 100) / 100]));
  const totalCost = costsByType.reduce((sum, c) => sum + c.total, 0);

  return {
    project: { id: project._id, name: project.name, code: project.code, budget: project.budget, status: project.status },
    revenue: Math.round(revenue * 100) / 100,
    invoiceCount,
    totalCost: Math.round(totalCost * 100) / 100,
    costBreakdown, // { material: X, expense: Y, manual: Z, ... }
    profit: Math.round((revenue - totalCost) * 100) / 100,
    budgetRemaining: Math.round((project.budget - totalCost) * 100) / 100,
    budgetUtilization: project.budget > 0 ? Math.round((totalCost / project.budget) * 10000) / 100 : null, // percent
  };
}

function listCosts(projectId) {
  return ProjectCost.find({ projectId }).sort({ date: -1 });
}

/** Project docs/wiki — simple free-text/markdown notes pages, multiple per project. */
function listDocs(companyId, projectId) {
  return ProjectDoc.find({ companyId, projectId }).sort({ updatedAt: -1 });
}

function createDoc(input) {
  const { companyId, projectId, title, body, createdBy } = input;
  if (!projectId) throw new Error('projectId is required.');
  if (!title) throw new Error('title is required.');
  return ProjectDoc.create({ companyId, projectId, title, body: body || '', createdBy: createdBy || null });
}

async function updateDoc(companyId, docId, patch) {
  const { title, body } = patch;
  const update = {};
  if (title !== undefined) update.title = title;
  if (body !== undefined) update.body = body;
  const doc = await ProjectDoc.findOneAndUpdate({ _id: docId, companyId }, update, { new: true });
  if (!doc) throw new Error('Doc not found.');
  return doc;
}

async function deleteDoc(companyId, docId) {
  const doc = await ProjectDoc.findOneAndDelete({ _id: docId, companyId });
  if (!doc) throw new Error('Doc not found.');
  return doc;
}

module.exports = {
  createProject, updateStatus, logManualCost, profitability, listCosts,
  listDocs, createDoc, updateDoc, deleteDoc,
};
