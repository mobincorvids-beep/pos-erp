const projectBillingService = require('../services/projectBillingService');

async function createMilestone(req, res) {
  try {
    const milestone = await projectBillingService.createMilestone(req.companyId, req.body);
    res.status(201).json(milestone);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listMilestones(req, res) {
  try {
    const rows = await projectBillingService.listMilestones(req.companyId, req.query.projectId);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function completeMilestone(req, res) {
  try {
    const milestone = await projectBillingService.completeMilestone(req.companyId, req.params.id);
    res.json(milestone);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function billMilestone(req, res) {
  try {
    const invoice = await projectBillingService.billMilestone(req.companyId, req.params.id, {
      retentionPercent: req.body.retentionPercent, userId: req.auth.userId,
    });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function releaseRetention(req, res) {
  try {
    const invoice = await projectBillingService.releaseRetention(req.companyId, req.params.invoiceId, { userId: req.auth.userId });
    res.status(201).json(invoice);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listProjectInvoices(req, res) {
  try {
    const rows = await projectBillingService.listProjectInvoices(req.companyId, req.query.projectId);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getOutstandingRetention(req, res) {
  try {
    const total = await projectBillingService.getOutstandingRetention(req.companyId, req.query.projectId);
    res.json({ projectId: req.query.projectId, outstandingRetention: total });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getPOCRevenue(req, res) {
  try {
    const result = await projectBillingService.getPOCRevenue(req.companyId, req.params.projectId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  createMilestone, listMilestones, completeMilestone, billMilestone,
  releaseRetention, listProjectInvoices, getOutstandingRetention, getPOCRevenue,
};
