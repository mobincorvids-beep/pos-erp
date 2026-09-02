const Lead = require('../models/Lead');
const Opportunity = require('../models/Opportunity');
const crmPipelineService = require('../services/crmPipelineService');
const crmAutomationService = require('../services/crmAutomationService');

// --- Leads ------------------------------------------------------------------

async function createLead(req, res) {
  try {
    const lead = await crmPipelineService.createLead({ ...req.body, companyId: req.companyId });
    res.status(201).json(lead);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listLeads(req, res) {
  const rows = await crmPipelineService.listLeads(req.companyId, { status: req.query.status });
  res.json(rows);
}

async function getLead(req, res) {
  const lead = await Lead.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!lead) return res.status(404).json({ error: 'Lead not found.' });
  res.json(lead);
}

async function updateLeadStatus(req, res) {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    const updated = await crmPipelineService.updateLeadStatus(req.params.id, req.body.status);
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function convertLead(req, res) {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    const result = await crmPipelineService.convertLeadToCustomer(req.params.id, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Opportunities ------------------------------------------------------------

async function createOpportunity(req, res) {
  try {
    const opportunity = await crmPipelineService.createOpportunity({ ...req.body, companyId: req.companyId });
    res.status(201).json(opportunity);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listOpportunities(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.stage) filter.stage = req.query.stage;
  const rows = await Opportunity.find(filter).sort({ updatedAt: -1 }).populate('customerId', 'name').populate('leadId', 'name').limit(500);
  res.json(rows);
}

async function getOpportunity(req, res) {
  const opportunity = await Opportunity.findOne({ _id: req.params.id, companyId: req.companyId }).populate('customerId', 'name').populate('leadId', 'name');
  if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });
  res.json(opportunity);
}

async function updateOpportunityStage(req, res) {
  try {
    const opportunity = await Opportunity.findOne({ _id: req.params.id, companyId: req.companyId });
    if (!opportunity) return res.status(404).json({ error: 'Opportunity not found.' });
    const { stage, ...extra } = req.body;
    const updated = await crmPipelineService.updateOpportunityStage(req.params.id, stage, { ...extra, userId: req.auth.userId });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function pipeline(req, res) {
  const grouped = await crmPipelineService.listPipeline(req.companyId, { assignedToUserId: req.query.assignedToUserId });
  res.json(grouped);
}

async function pipelineSummary(req, res) {
  const summary = await crmPipelineService.pipelineSummary(req.companyId, req.query.days ? Number(req.query.days) : undefined);
  res.json(summary);
}

async function generateQuote(req, res) {
  try {
    const result = await crmPipelineService.generateQuoteForOpportunity(req.params.id, req.companyId, {
      ...req.body, userId: req.auth.userId,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Automation rules --------------------------------------------------------

async function createAutomationRule(req, res) {
  try {
    const rule = await crmAutomationService.createRule({
      ...req.body, companyId: req.companyId, createdByUserId: req.auth.userId,
    });
    res.status(201).json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listAutomationRules(req, res) {
  const rows = await crmAutomationService.listRules(req.companyId);
  res.json(rows);
}

async function updateAutomationRule(req, res) {
  try {
    const rule = await crmAutomationService.updateRule(req.params.id, req.companyId, req.body);
    res.json(rule);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deleteAutomationRule(req, res) {
  try {
    await crmAutomationService.deleteRule(req.params.id, req.companyId);
    res.status(204).end();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  createLead, listLeads, getLead, updateLeadStatus, convertLead,
  createOpportunity, listOpportunities, getOpportunity, updateOpportunityStage,
  pipeline, pipelineSummary, generateQuote,
  createAutomationRule, listAutomationRules, updateAutomationRule, deleteAutomationRule,
};
