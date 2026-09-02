/**
 * CrmPipelineService — the actual sales pipeline: Lead -> Opportunity ->
 * Won/Lost. Deliberately reuses existing collections rather than forking
 * parallel ones: converting a Lead creates a real Customer (Customer.js),
 * and winning an Opportunity creates a real quotation-status Sale through
 * salesOrderService.createQuotation() — the exact same pathway a
 * salesperson uses to hand-write a quotation — so a won deal shows up in
 * the real Sales/Quotations workflow instead of a CRM-only shadow record.
 */
const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const Customer = require('../models/Customer');
const salesOrderService = require('./salesOrderService');
const crmAutomationService = require('./crmAutomationService');

const STAGES = ['new', 'contacted', 'proposal', 'negotiation', 'won', 'lost'];

// Sensible default probability per stage — used only when the caller
// doesn't explicitly set one (e.g. creating an opportunity, or moving a
// stage without an override). A user can still set any 0-100 value.
const STAGE_PROBABILITY = {
  new: 10, contacted: 25, proposal: 50, negotiation: 75, won: 100, lost: 0,
};

// --- Leads ----------------------------------------------------------------

function createLead(input) {
  const { companyId, name, contactName, phone, email, source, assignedToUserId, notes } = input;
  if (!name) throw new Error('Lead name is required.');
  return Lead.create({
    companyId, name, contactName, phone, email,
    source: source || 'other', assignedToUserId: assignedToUserId || null, notes: notes || '',
  });
}

async function updateLeadStatus(leadId, status) {
  if (!['new', 'contacted', 'qualified', 'unqualified', 'converted'].includes(status)) {
    throw new Error(`Invalid lead status "${status}".`);
  }
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Lead not found.');
  if (lead.status === 'converted') throw new Error('This lead has already been converted to a customer.');
  if (status === 'converted') throw new Error('Use the convert endpoint to convert a lead to a customer.');
  lead.status = status;
  await lead.save();
  return lead;
}

/**
 * Converts a Lead into a real Customer — reuses Customer.js rather than
 * forking a separate "lead-turned-customer" concept. Idempotent: converting
 * an already-converted lead just returns the existing linked customer
 * instead of creating a duplicate, so a "won" opportunity that auto-converts
 * its lead and a user who separately clicks "Convert" never produce two
 * Customer documents for the same lead.
 */
async function convertLeadToCustomer(leadId, customerData = {}) {
  const lead = await Lead.findById(leadId);
  if (!lead) throw new Error('Lead not found.');

  if (lead.status === 'converted' && lead.convertedCustomerId) {
    return { lead, customer: await Customer.findById(lead.convertedCustomerId) };
  }

  const customer = await Customer.create({
    companyId: lead.companyId,
    name: customerData.name || lead.name,
    phone: customerData.phone || lead.phone,
    email: customerData.email || lead.email,
    address: customerData.address || '',
    tags: customerData.tags || [],
  });

  lead.status = 'converted';
  lead.convertedCustomerId = customer._id;
  await lead.save();

  return { lead, customer };
}

// --- Opportunities ----------------------------------------------------------

async function createOpportunity(input) {
  const {
    companyId, leadId, customerId, title, estimatedValue,
    stage, probability, expectedCloseDate, assignedToUserId,
  } = input;

  if (!title) throw new Error('Opportunity title is required.');
  if (estimatedValue === undefined || estimatedValue === null || estimatedValue < 0) {
    throw new Error('estimatedValue must be a non-negative number.');
  }
  if (!leadId && !customerId) throw new Error('An opportunity needs either a leadId or a customerId.');

  if (leadId) {
    const lead = await Lead.findOne({ _id: leadId, companyId });
    if (!lead) throw new Error('Lead not found.');
  }
  if (customerId) {
    const customer = await Customer.findOne({ _id: customerId, companyId });
    if (!customer) throw new Error('Customer not found.');
  }

  const resolvedStage = stage && STAGES.includes(stage) ? stage : 'new';
  if (resolvedStage === 'won' || resolvedStage === 'lost') {
    throw new Error('An opportunity cannot be created directly in the "won" or "lost" stage: use the stage-change action.');
  }

  return Opportunity.create({
    companyId, leadId: leadId || null, customerId: customerId || null,
    title, estimatedValue,
    stage: resolvedStage,
    probability: probability !== undefined ? probability : STAGE_PROBABILITY[resolvedStage],
    expectedCloseDate: expectedCloseDate || null,
    assignedToUserId: assignedToUserId || null,
  });
}

/**
 * Moves an opportunity to a new stage. 'lost' requires a lostReason.
 * 'won' is the real logic: it must end up with a customerId (auto-converting
 * the linked lead if there is one and no customer yet), and it creates a
 * real quotation-status Sale via salesOrderService.createQuotation() — the
 * exact pathway already used elsewhere in this app for quotations — so the
 * deal is now a real document in Sales/Quotations, not just a CRM record.
 *
 * @param {Object} extra - { lostReason, branchId, warehouseId, items, userId, customerData }
 *   branchId/warehouseId/items/userId are required only when stage === 'won'
 *   (they're exactly what salesOrderService.createQuotation needs to build
 *   a real Sale document — an opportunity has no product lines of its own).
 */
async function updateOpportunityStage(opportunityId, stage, extra = {}) {
  if (!STAGES.includes(stage)) throw new Error(`Invalid stage "${stage}".`);

  const opportunity = await Opportunity.findById(opportunityId);
  if (!opportunity) throw new Error('Opportunity not found.');
  if (opportunity.stage === 'won' || opportunity.stage === 'lost') {
    throw new Error(`This opportunity is already ${opportunity.stage} and cannot change stage further.`);
  }

  if (stage === 'lost') {
    if (!extra.lostReason || !extra.lostReason.trim()) {
      throw new Error('lostReason is required when moving an opportunity to "lost".');
    }
    opportunity.stage = 'lost';
    opportunity.lostReason = extra.lostReason.trim();
    opportunity.probability = STAGE_PROBABILITY.lost;
    await opportunity.save();
    await crmAutomationService.fireForStageChange(opportunity, 'lost');
    return opportunity;
  }

  if (stage === 'won') {
    let customerId = opportunity.customerId;

    if (!customerId) {
      if (!opportunity.leadId) {
        throw new Error('Cannot win an opportunity with no customer and no lead to convert.');
      }
      const { customer } = await convertLeadToCustomer(opportunity.leadId, extra.customerData || {});
      customerId = customer._id;
    }

    if (!extra.branchId) throw new Error('branchId is required to create the quotation for a won opportunity.');
    if (!extra.warehouseId) throw new Error('warehouseId is required to create the quotation for a won opportunity.');
    if (!extra.items || extra.items.length === 0) {
      throw new Error('items (the products/quantities being quoted) are required to win an opportunity.');
    }
    if (!extra.userId) throw new Error('userId is required to create the quotation for a won opportunity.');

    const sale = await salesOrderService.createQuotation({
      companyId: opportunity.companyId,
      branchId: extra.branchId,
      warehouseId: extra.warehouseId,
      customerId,
      userId: extra.userId,
      items: extra.items,
      validUntil: extra.validUntil || null,
    });

    opportunity.stage = 'won';
    opportunity.probability = STAGE_PROBABILITY.won;
    opportunity.customerId = customerId;
    opportunity.wonSaleId = sale._id;
    await opportunity.save();
    await crmAutomationService.fireForStageChange(opportunity, 'won');
    return opportunity;
  }

  // Ordinary forward/backward move between new/contacted/proposal/negotiation.
  opportunity.stage = stage;
  opportunity.probability = extra.probability !== undefined ? extra.probability : STAGE_PROBABILITY[stage];
  await opportunity.save();
  await crmAutomationService.fireForStageChange(opportunity, stage);
  return opportunity;
}

/**
 * Generates a standalone quote (a quotation-status Sale) directly from an
 * opportunity, reusing the exact same salesOrderService.createQuotation()
 * pathway the "win" flow and the manual Sales/Quotations screens use — no
 * duplicated document-creation logic. Pre-fills from the opportunity's
 * customer; the caller still supplies real product lines (an opportunity
 * has no line items of its own to draw from).
 */
async function generateQuoteForOpportunity(opportunityId, companyId, extra = {}) {
  const opportunity = await Opportunity.findOne({ _id: opportunityId, companyId });
  if (!opportunity) throw new Error('Opportunity not found.');

  let customerId = opportunity.customerId;
  if (!customerId) {
    if (!opportunity.leadId) throw new Error('This opportunity has no customer or lead to quote against.');
    const { customer } = await convertLeadToCustomer(opportunity.leadId, extra.customerData || {});
    customerId = customer._id;
    opportunity.customerId = customerId;
  }

  if (!extra.branchId) throw new Error('branchId is required to generate a quote.');
  if (!extra.warehouseId) throw new Error('warehouseId is required to generate a quote.');
  if (!extra.items || extra.items.length === 0) throw new Error('items are required to generate a quote.');
  if (!extra.userId) throw new Error('userId is required to generate a quote.');

  const sale = await salesOrderService.createQuotation({
    companyId: opportunity.companyId,
    branchId: extra.branchId,
    warehouseId: extra.warehouseId,
    customerId,
    userId: extra.userId,
    items: extra.items,
    validUntil: extra.validUntil || null,
  });

  opportunity.quoteSaleId = sale._id;
  await opportunity.save();
  return { opportunity, sale };
}

/** Opportunities grouped by stage: the shape a kanban board needs directly. */
async function listPipeline(companyId, filters = {}) {
  const filter = { companyId };
  if (filters.assignedToUserId) filter.assignedToUserId = filters.assignedToUserId;

  const opportunities = await Opportunity.find(filter)
    .sort({ updatedAt: -1 })
    .populate('customerId', 'name')
    .populate('leadId', 'name')
    .limit(1000);

  const grouped = {};
  for (const s of STAGES) grouped[s] = [];
  for (const opp of opportunities) {
    (grouped[opp.stage] || (grouped[opp.stage] = [])).push(opp);
  }
  return grouped;
}

/**
 * Real aggregation: total pipeline value by stage, win rate (won / (won +
 * lost)) over the last `days` days, and average won deal size. Not fake
 * numbers — computed straight off Opportunity documents.
 */
async function pipelineSummary(companyId, days = 90) {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const [byStage, closedRecent] = await Promise.all([
    Opportunity.aggregate([
      { $match: { companyId } },
      { $group: { _id: '$stage', totalValue: { $sum: '$estimatedValue' }, count: { $sum: 1 } } },
    ]),
    Opportunity.aggregate([
      { $match: { companyId, stage: { $in: ['won', 'lost'] }, updatedAt: { $gte: since } } },
      { $group: { _id: '$stage', totalValue: { $sum: '$estimatedValue' }, count: { $sum: 1 } } },
    ]),
  ]);

  const valueByStage = {};
  const countByStage = {};
  for (const s of STAGES) { valueByStage[s] = 0; countByStage[s] = 0; }
  for (const row of byStage) {
    valueByStage[row._id] = row.totalValue;
    countByStage[row._id] = row.count;
  }

  const wonRow = closedRecent.find((r) => r._id === 'won') || { count: 0, totalValue: 0 };
  const lostRow = closedRecent.find((r) => r._id === 'lost') || { count: 0, totalValue: 0 };
  const closedCount = wonRow.count + lostRow.count;
  const winRate = closedCount > 0 ? wonRow.count / closedCount : 0;
  const averageWonDealSize = wonRow.count > 0 ? wonRow.totalValue / wonRow.count : 0;

  // Open pipeline value excludes won/lost — that's closed business, not
  // pipeline still in play.
  const openPipelineValue = STAGES
    .filter((s) => s !== 'won' && s !== 'lost')
    .reduce((sum, s) => sum + valueByStage[s], 0);

  return {
    periodDays: days,
    valueByStage, countByStage,
    openPipelineValue,
    winRate,
    wonCount: wonRow.count, lostCount: lostRow.count,
    averageWonDealSize,
  };
}

// --- Opportunity/Lead reads --------------------------------------------------

function listLeads(companyId, filters = {}) {
  const filter = { companyId };
  if (filters.status) filter.status = filters.status;
  return Lead.find(filter).sort({ createdAt: -1 }).limit(500);
}

module.exports = {
  STAGES,
  createLead, updateLeadStatus, convertLeadToCustomer, listLeads,
  createOpportunity, updateOpportunityStage, generateQuoteForOpportunity, listPipeline, pipelineSummary,
};
