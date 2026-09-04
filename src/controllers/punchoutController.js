const punchoutService = require('../services/punchoutService');

async function browse(req, res) {
  try {
    const rows = await punchoutService.browseCatalog(req.companyId, { supplierId: req.query.supplierId, search: req.query.search });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function checkout(req, res) {
  try {
    const { branchId, cart, note } = req.body || {};
    const requisition = await punchoutService.createRequisitionFromCart(req.companyId, {
      branchId, cart, requestedBy: req.user?._id, note,
    });
    res.status(201).json(requisition);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { browse, checkout };
