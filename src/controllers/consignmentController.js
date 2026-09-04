const consignmentService = require('../services/consignmentService');

async function list(req, res) {
  try {
    const { supplierId, warehouseId, productId } = req.query;
    const rows = await consignmentService.listConsignmentStock(req.companyId, { supplierId, warehouseId, productId });
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function outstanding(req, res) {
  try {
    const { supplierId } = req.query;
    const result = await consignmentService.getOutstandingConsignmentLiability(req.companyId, supplierId || null);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function settle(req, res) {
  try {
    const { supplierId, amount, paymentAccountId, branchId } = req.body || {};
    const result = await consignmentService.settleConsignmentLiability(
      req.companyId, supplierId, Number(amount), { branchId, paymentAccountId, userId: req.user?._id }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, outstanding, settle };
