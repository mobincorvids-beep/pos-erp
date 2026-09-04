/**
 * ProjectBillingService — closes three related Project Costing gaps at
 * once, since they share the same underlying data (contract value,
 * milestones, actual cost to date): milestone/progress billing,
 * retention/holdback billing, and WIP/percentage-of-completion revenue
 * recognition.
 *
 * Accounting postings here are best-effort, same defensive pattern
 * salesOrderService already uses: if the company hasn't configured
 * accountsReceivableId/salesRevenueId (defaultAccountsService.resolve
 * returns null), the invoice record itself is still created — it just
 * isn't posted to the general ledger — rather than failing the whole
 * billing action over unrelated chart-of-accounts setup.
 */
const mongoose = require('mongoose');
const Project = require('../models/Project');
const ProjectMilestone = require('../models/ProjectMilestone');
const ProjectInvoice = require('../models/ProjectInvoice');
const ProjectCost = require('../models/ProjectCost');
const accountingService = require('./accountingService');
const defaultAccountsService = require('./defaultAccountsService');
const { nextDocumentNumber } = require('./numberingService');

async function createMilestone(companyId, input) {
  const project = await Project.findOne({ _id: input.projectId, companyId });
  if (!project) throw new Error('Project not found.');
  if (input.billingType === 'fixed_amount' && !(input.amount > 0)) {
    throw new Error('A fixed_amount milestone needs amount > 0.');
  }
  if (input.billingType === 'percent_of_contract' && !(input.percentOfContract > 0)) {
    throw new Error('A percent_of_contract milestone needs percentOfContract > 0.');
  }
  return ProjectMilestone.create({ ...input, companyId });
}

function listMilestones(companyId, projectId) {
  return ProjectMilestone.find({ companyId, projectId }).sort({ sequence: 1 });
}

async function completeMilestone(companyId, milestoneId) {
  const milestone = await ProjectMilestone.findOne({ _id: milestoneId, companyId });
  if (!milestone) throw new Error('Milestone not found.');
  if (milestone.status === 'billed') throw new Error('This milestone has already been billed.');
  milestone.status = 'completed';
  milestone.completedAt = new Date();
  return milestone.save();
}

/**
 * Bills a completed milestone: computes the gross amount (flat, or a
 * percentage of the project's contractValue), withholds retentionPercent
 * of it as a holdback, and posts the net amount to AR/Revenue if the
 * company's default accounts are configured.
 */
async function billMilestone(companyId, milestoneId, { retentionPercent = 0, userId } = {}) {
  const session = await mongoose.startSession();
  try {
    let invoice;
    await session.withTransaction(async () => {
      const milestone = await ProjectMilestone.findOne({ _id: milestoneId, companyId }).session(session);
      if (!milestone) throw new Error('Milestone not found.');
      if (milestone.status === 'billed') throw new Error('This milestone has already been billed.');
      if (milestone.status !== 'completed') throw new Error('Only a completed milestone can be billed.');

      const project = await Project.findById(milestone.projectId).session(session);
      if (!project) throw new Error('Project not found.');

      const grossAmount = milestone.billingType === 'fixed_amount'
        ? milestone.amount
        : Math.round((project.contractValue * milestone.percentOfContract / 100) * 100) / 100;

      const retentionHeld = Math.round((grossAmount * retentionPercent / 100) * 100) / 100;
      const netAmount = grossAmount - retentionHeld;

      [invoice] = await ProjectInvoice.create([{
        companyId, projectId: project._id, milestoneId: milestone._id,
        invoiceNumber: nextDocumentNumber('PRJINV'),
        invoiceType: 'milestone',
        grossAmount, retentionHeld, netAmount,
        status: 'issued',
      }], { session });

      milestone.status = 'billed';
      milestone.projectInvoiceId = invoice._id;
      await milestone.save({ session });

      await postBillingVoucher(session, {
        companyId, branchId: null, narration: `Milestone "${milestone.name}" — ${project.name}`,
        netAmount, grossAmount, referenceId: invoice._id, userId,
      });
    });
    return invoice;
  } finally {
    session.endSession();
  }
}

/**
 * Releases previously-held retention on an already-billed invoice — a
 * second ProjectInvoice (invoiceType 'retention_release') for the held
 * amount, linked back to the original so outstanding retention across a
 * project is a simple query.
 */
async function releaseRetention(companyId, projectInvoiceId, { userId } = {}) {
  const session = await mongoose.startSession();
  try {
    let releaseInvoice;
    await session.withTransaction(async () => {
      const original = await ProjectInvoice.findOne({ _id: projectInvoiceId, companyId }).session(session);
      if (!original) throw new Error('Project invoice not found.');
      if (original.retentionHeld <= 0) throw new Error('This invoice has no retention held to release.');
      if (original.retentionReleasedInvoiceId) throw new Error('Retention on this invoice was already released.');

      const project = await Project.findById(original.projectId).session(session);

      [releaseInvoice] = await ProjectInvoice.create([{
        companyId, projectId: original.projectId,
        invoiceNumber: nextDocumentNumber('PRJRET'),
        invoiceType: 'retention_release',
        grossAmount: original.retentionHeld, retentionHeld: 0, netAmount: original.retentionHeld,
        status: 'issued',
      }], { session });

      original.retentionReleasedInvoiceId = releaseInvoice._id;
      await original.save({ session });

      await postBillingVoucher(session, {
        companyId, branchId: null, narration: `Retention release — ${project?.name || original.projectId}`,
        netAmount: original.retentionHeld, grossAmount: original.retentionHeld,
        referenceId: releaseInvoice._id, userId,
      });
    });
    return releaseInvoice;
  } finally {
    session.endSession();
  }
}

async function postBillingVoucher(session, { companyId, branchId, narration, netAmount, referenceId, userId }) {
  if (netAmount <= 0) return;
  const ar = await defaultAccountsService.resolve(companyId, 'accountsReceivableId', session);
  const revenue = await defaultAccountsService.resolve(companyId, 'salesRevenueId', session);
  if (!ar || !revenue) return; // not configured — invoice record still stands, just not posted to the GL

  await accountingService.postVoucher({
    companyId, branchId, type: 'journal', narration,
    entries: [
      { accountId: ar, debit: netAmount, credit: 0 },
      { accountId: revenue, debit: 0, credit: netAmount },
    ],
    referenceType: 'ProjectInvoice', referenceId, userId,
  }, session);
}

function listProjectInvoices(companyId, projectId) {
  return ProjectInvoice.find({ companyId, projectId }).sort({ issuedAt: -1 });
}

/** Outstanding (not yet released) retention across a project — sum of retentionHeld on invoices with no retentionReleasedInvoiceId. */
async function getOutstandingRetention(companyId, projectId) {
  const rows = await ProjectInvoice.find({ companyId, projectId, retentionHeld: { $gt: 0 }, retentionReleasedInvoiceId: null });
  return rows.reduce((sum, r) => sum + r.retentionHeld, 0);
}

/**
 * Percentage-of-completion revenue recognition: percent complete =
 * actual cost to date / project.budget (the internal cost estimate),
 * capped at 100% — a cost-based POC, the standard simplification when
 * there's no separate "estimated cost to complete" input to work from.
 * Recognized revenue = percent * contractValue. overUnderBilling
 * compares that against what's actually been invoiced so far (billed
 * ahead of progress = "overbilling", a liability; billed behind = an
 * unbilled receivable) — the two numbers a POC report exists to surface.
 */
async function getPOCRevenue(companyId, projectId) {
  const project = await Project.findOne({ _id: projectId, companyId });
  if (!project) throw new Error('Project not found.');

  const costs = await ProjectCost.find({ companyId, projectId });
  const actualCostToDate = costs.reduce((sum, c) => sum + (c.amount || 0), 0);

  const percentComplete = project.budget > 0 ? Math.min(actualCostToDate / project.budget, 1) : 0;
  const recognizedRevenue = Math.round(percentComplete * project.contractValue * 100) / 100;

  const invoices = await ProjectInvoice.find({ companyId, projectId, invoiceType: { $ne: 'retention_release' } });
  const billedToDate = invoices.reduce((sum, i) => sum + i.grossAmount, 0);

  return {
    projectId, contractValue: project.contractValue, budget: project.budget,
    actualCostToDate, percentComplete: Math.round(percentComplete * 10000) / 100, // as a %, 2dp
    recognizedRevenue, billedToDate,
    overUnderBilling: Math.round((billedToDate - recognizedRevenue) * 100) / 100, // +ve = billed ahead of progress
  };
}

module.exports = {
  createMilestone, listMilestones, completeMilestone, billMilestone,
  releaseRetention, listProjectInvoices, getOutstandingRetention, getPOCRevenue,
};
