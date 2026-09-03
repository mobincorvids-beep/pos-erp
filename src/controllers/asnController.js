const asnService = require('../services/asnService');

async function create(req, res) {
  try {
    const asn = await asnService.createAsn({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(asn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function list(req, res) {
  try {
    const asns = await asnService.listAsns(req.companyId, req.query);
    res.json(asns);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  try {
    const asn = await asnService.getAsn(req.params.id, req.companyId);
    if (!asn) return res.status(404).json({ error: 'ASN not found.' });
    res.json(asn);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function matchGrn(req, res) {
  try {
    const result = await asnService.matchGrnToAsn(req.params.id, req.body.grnId, req.companyId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { create, list, get, matchGrn };
