const batchTraceabilityService = require('../services/batchTraceabilityService');

async function getGenealogy(req, res) {
  try {
    const result = await batchTraceabilityService.getBatchGenealogy(req.companyId, req.params.batchId);
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { getGenealogy };
