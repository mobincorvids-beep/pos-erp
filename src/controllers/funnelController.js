const funnelService = require('../services/funnelService');

// --- Authenticated staff endpoints -----------------------------------

async function createFunnel(req, res) {
  try {
    const funnel = await funnelService.createFunnel({ ...req.body, companyId: req.companyId });
    res.status(201).json(funnel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listFunnels(req, res) {
  const funnels = await funnelService.listFunnels(req.companyId);
  res.json(funnels);
}

async function getFunnel(req, res) {
  const funnel = await funnelService.getFunnel(req.params.id, req.companyId);
  if (!funnel) return res.status(404).json({ error: 'Funnel not found.' });
  res.json(funnel);
}

async function updateFunnel(req, res) {
  try {
    const funnel = await funnelService.updateFunnel(req.params.id, req.companyId, req.body);
    res.json(funnel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function publishFunnel(req, res) {
  try {
    const funnel = await funnelService.publishFunnel(req.params.id, req.companyId, req.body?.publish !== false);
    res.json(funnel);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function analytics(req, res) {
  try {
    const stats = await funnelService.funnelAnalytics(req.params.id, req.companyId);
    res.json(stats);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

// --- Public endpoints (no auth) ----------------------------------------

async function publicGetFunnel(req, res) {
  const funnel = await funnelService.getFunnelByPublicSlug(req.params.slug);
  if (!funnel) return res.status(404).json({ error: 'This page is not available.' });
  // Only expose what a visitor needs to render the page — never leak
  // internal fields (companyId, submitCount, timestamps) to the public.
  res.json({
    id: funnel._id,
    name: funnel.name,
    headline: funnel.headline,
    bodyContent: funnel.bodyContent,
    formFields: funnel.formFields,
  });
}

async function publicSubmitFunnel(req, res) {
  try {
    const funnel = await funnelService.getFunnelByPublicSlug(req.params.slug);
    if (!funnel) return res.status(404).json({ error: 'This page is not available.' });
    const { submission } = await funnelService.submitFunnel(funnel._id, req.body || {});
    res.status(201).json({ ok: true, submissionId: submission._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  createFunnel, listFunnels, getFunnel, updateFunnel, publishFunnel, analytics,
  publicGetFunnel, publicSubmitFunnel,
};
