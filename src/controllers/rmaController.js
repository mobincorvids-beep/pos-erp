const rmaService = require('../services/rmaService');

async function createRMA(req, res) {
  try {
    const rma = await rmaService.createRMA(req.companyId, { ...req.body, requestedBy: req.auth.userId });
    res.status(201).json(rma);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listRMAs(req, res) {
  try {
    const { status, saleId, customerId } = req.query;
    const rmas = await rmaService.listRMAs(req.companyId, { status, saleId, customerId });
    res.json(rmas);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function getRMA(req, res) {
  try {
    const rma = await rmaService.getRMA(req.companyId, req.params.id);
    res.json(rma);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}

function statusTransition(targetStatus) {
  return async (req, res) => {
    try {
      const rma = await rmaService.updateStatus(req.companyId, req.params.id, targetStatus, { ...req.body, userId: req.auth.userId });
      res.json(rma);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  };
}

module.exports = {
  createRMA, listRMAs, getRMA,
  approve: statusTransition('approved'),
  reject: statusTransition('rejected'),
  receive: statusTransition('received'),
  refund: statusTransition('refunded'),
};
