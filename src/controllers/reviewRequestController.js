const reviewRequestService = require('../services/reviewRequestService');

// --- Authenticated staff endpoints -----------------------------------

async function send(req, res) {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const { reviewRequest } = await reviewRequestService.createAndSend(req.companyId, { ...req.body, baseUrl });
    res.status(201).json(reviewRequest);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  const rows = await reviewRequestService.listReviewRequests(req.companyId, { status: req.query.status });
  res.json(rows);
}

async function followUpList(req, res) {
  const rows = await reviewRequestService.needsFollowUp(req.companyId);
  res.json(rows);
}

// --- Public endpoints (no auth, token-based) ----------------------------

async function publicGet(req, res) {
  try {
    const reviewRequest = await reviewRequestService.getByToken(req.params.token);
    res.json({
      customerName: reviewRequest.customerId?.name || '',
      status: reviewRequest.status,
      rating: reviewRequest.rating,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

async function publicRespond(req, res) {
  try {
    const reviewRequest = await reviewRequestService.respond(req.params.token, req.body || {});
    res.status(201).json({ ok: true, rating: reviewRequest.rating, offerShare: reviewRequest.rating >= 4 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function publicShare(req, res) {
  try {
    await reviewRequestService.markSharedPublicly(req.params.token);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { send, list, followUpList, publicGet, publicRespond, publicShare };
