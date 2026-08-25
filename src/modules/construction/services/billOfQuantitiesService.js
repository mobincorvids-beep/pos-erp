/**
 * BillOfQuantitiesService — the genuinely new mechanic: a real,
 * PRE-APPROVED estimate created before a project's actual costs
 * accumulate. varianceReport() compares it against the SAME ProjectCost
 * records core Project's own profitability() already reads — every
 * approved Expense and received PurchaseOrder tagged with this project
 * already writes a real ProjectCost automatically, so this needed no new
 * "actuals" source, only a real "what we planned to spend" one to compare
 * it against, which didn't exist anywhere in core before this.
 */
const mongoose = require('mongoose');
const BillOfQuantities = require('../models/BillOfQuantities');
const ProjectCost = require('../../../models/ProjectCost');

function createBOQ(input) {
  const { companyId, projectId, title, lineItems } = input;
  if (!lineItems || lineItems.length === 0) throw new Error('At least one line item is required.');

  const computedLines = lineItems.map((line) => ({
    ...line,
    estimatedAmount: Math.round(line.estimatedQuantity * line.estimatedRate * 100) / 100,
  }));
  const totalEstimated = Math.round(computedLines.reduce((sum, l) => sum + l.estimatedAmount, 0) * 100) / 100;

  return BillOfQuantities.create({ companyId, projectId, title, lineItems: computedLines, totalEstimated });
}

function getBOQ(boqId) {
  return BillOfQuantities.findById(boqId);
}

function listBOQs(companyId, projectId) {
  const filter = { companyId };
  if (projectId) filter.projectId = projectId;
  return BillOfQuantities.find(filter).sort({ createdAt: -1 });
}

/** Corrects a mistaken estimate — a pure planning document nothing else in the app references, so a full re-edit (title and/or line items, with totals recomputed the same way createBOQ does) is safe at any time. */
async function updateBOQ(boqId, { title, lineItems }) {
  const boq = await BillOfQuantities.findById(boqId);
  if (!boq) throw new Error('Bill of Quantities not found.');
  if (title !== undefined) boq.title = title;
  if (lineItems !== undefined) {
    if (!lineItems.length) throw new Error('At least one line item is required.');
    boq.lineItems = lineItems.map((line) => ({
      ...line,
      estimatedAmount: Math.round(line.estimatedQuantity * line.estimatedRate * 100) / 100,
    }));
    boq.totalEstimated = Math.round(boq.lineItems.reduce((sum, l) => sum + l.estimatedAmount, 0) * 100) / 100;
  }
  await boq.save();
  return boq;
}

function deleteBOQ(boqId) {
  return BillOfQuantities.findByIdAndDelete(boqId);
}

/**
 * Groups the BOQ's own line items by costType (a project can have several
 * line items sharing one type — two different material lines both
 * estimate against the same "material" actual-cost bucket, since
 * ProjectCost itself has no finer-grained "which specific line item" link
 * — comparing at the type level is the most granular honest comparison
 * possible without inventing false precision), then compares each
 * type's estimated total against the REAL actual total from ProjectCost.
 */
async function varianceReport(boqId) {
  const boq = await BillOfQuantities.findById(boqId);
  if (!boq) throw new Error('Bill of Quantities not found.');

  const estimatedByType = {};
  boq.lineItems.forEach((line) => {
    estimatedByType[line.costType] = Math.round(((estimatedByType[line.costType] || 0) + line.estimatedAmount) * 100) / 100;
  });

  const actualCosts = await ProjectCost.aggregate([
    { $match: { projectId: new mongoose.Types.ObjectId(boq.projectId) } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  const actualByType = Object.fromEntries(actualCosts.map((c) => [c._id, Math.round(c.total * 100) / 100]));

  const byType = Object.keys(estimatedByType).map((type) => {
    const estimated = estimatedByType[type];
    const actual = actualByType[type] || 0;
    const variance = Math.round((actual - estimated) * 100) / 100;
    const variancePercent = estimated > 0 ? Math.round((variance / estimated) * 10000) / 100 : null;
    return { costType: type, estimated, actual, variance, variancePercent };
  });

  const totalEstimated = boq.totalEstimated;
  // Deliberately sums EVERY actual cost type, not just the ones the BOQ
  // happened to estimate for — a real project incurring cost in a
  // category nobody budgeted for at all is genuinely meaningful
  // information (pure overage with no baseline), not noise to filter out.
  const totalActual = Math.round(Object.values(actualByType).reduce((sum, v) => sum + v, 0) * 100) / 100;

  return { boqId: boq._id, byType, totalEstimated, totalActual, totalVariance: Math.round((totalActual - totalEstimated) * 100) / 100 };
}

module.exports = { createBOQ, getBOQ, listBOQs, varianceReport, updateBOQ, deleteBOQ };
