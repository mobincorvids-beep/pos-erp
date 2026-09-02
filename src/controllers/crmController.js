const Campaign = require('../models/Campaign');
const CustomerFeedback = require('../models/CustomerFeedback');
const crmService = require('../services/crmService');

async function addTags(req, res) {
  try {
    const customer = await crmService.addTags(req.params.customerId, req.body.tags);
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function removeTags(req, res) {
  try {
    const customer = await crmService.removeTags(req.params.customerId, req.body.tags);
    res.json(customer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function segment(req, res) {
  const tags = req.query.tags ? req.query.tags.split(',') : [];
  const customers = await crmService.findBySegment(req.companyId, tags);
  res.json(customers);
}

async function submitFeedback(req, res) {
  try {
    const feedback = await crmService.submitFeedback({
      ...req.body, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(feedback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listFeedback(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  const rows = await CustomerFeedback.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
}

async function resolveFeedback(req, res) {
  try {
    const feedback = await crmService.resolveFeedback(req.params.id, req.body.resolutionNote);
    res.json(feedback);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function scheduleFollowUp(req, res) {
  try {
    const followUp = await crmService.scheduleFollowUp({ ...req.body, companyId: req.companyId });
    res.status(201).json(followUp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function completeFollowUp(req, res) {
  try {
    const followUp = await crmService.completeFollowUp(req.params.id, req.body.completionNote);
    res.json(followUp);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function pendingFollowUps(req, res) {
  const rows = await crmService.pendingFollowUps(req.companyId, req.query.assignedToUserId || null);
  res.json(rows);
}

async function createCampaign(req, res) {
  try {
    const campaign = await crmService.createCampaign({
      ...req.body, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(campaign);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listCampaigns(req, res) {
  const rows = await Campaign.find({ companyId: req.companyId }).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
}

async function sendCampaign(req, res) {
  try {
    const result = await crmService.sendCampaign(req.params.id);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function contactTimeline(req, res) {
  try {
    const timeline = await crmService.getContactTimeline(req.companyId, req.params.customerId);
    res.json(timeline);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

module.exports = {
  addTags, removeTags, segment,
  submitFeedback, listFeedback, resolveFeedback,
  scheduleFollowUp, completeFollowUp, pendingFollowUps,
  createCampaign, listCampaigns, sendCampaign,
  contactTimeline,
};
