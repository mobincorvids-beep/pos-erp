const priceListService = require('../services/priceListService');

async function list(req, res) {
  const rows = await priceListService.list(req.companyId);
  res.json(rows);
}

async function get(req, res) {
  const row = await priceListService.get(req.companyId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Price list not found.' });
  res.json(row);
}

async function create(req, res) {
  try {
    const row = await priceListService.create(req.companyId, req.body);
    res.status(201).json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function update(req, res) {
  try {
    const row = await priceListService.update(req.companyId, req.params.id, req.body);
    if (!row) return res.status(404).json({ error: 'Price list not found.' });
    res.json(row);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function remove(req, res) {
  const row = await priceListService.remove(req.companyId, req.params.id);
  if (!row) return res.status(404).json({ error: 'Price list not found.' });
  res.json({ ok: true });
}

/** Quotes a single line's tiered/group price without creating anything — the UI's "what would this cost" lookup. */
async function quote(req, res) {
  try {
    const { customerId, productId, variantId, quantity } = req.body;
    const result = await priceListService.resolvePrice(req.companyId, { customerId, productId, variantId, quantity });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, get, create, update, remove, quote };
