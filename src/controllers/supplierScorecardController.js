const supplierScorecardService = require('../services/supplierScorecardService');

async function getOne(req, res) {
  try {
    const result = await supplierScorecardService.getSupplierScorecard(
      req.companyId, req.params.id, { from: req.query.from, to: req.query.to }
    );
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function getAll(req, res) {
  try {
    const result = await supplierScorecardService.getAllSupplierScorecards(
      req.companyId, { from: req.query.from, to: req.query.to }
    );
    res.json(result);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { getOne, getAll };
