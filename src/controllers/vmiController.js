const vmiService = require('../services/vmiService');

async function createAgreement(req, res) {
  try {
    const { supplierId, warehouseId, productId, variantId, minQty, maxQty, unitCost, autoApprove } = req.body || {};
    const agreement = await vmiService.createAgreement(req.companyId, {
      supplierId, warehouseId, productId, variantId, minQty, maxQty, unitCost, autoApprove, userId: req.user?._id,
    });
    res.json(agreement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listAgreements(req, res) {
  try {
    res.json(await vmiService.listAgreements(req.companyId, { supplierId: req.query.supplierId, warehouseId: req.query.warehouseId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function setAgreementActive(req, res) {
  try {
    res.json(await vmiService.setAgreementActive(req.companyId, req.params.id, req.body?.isActive));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listProposals(req, res) {
  try {
    res.json(await vmiService.listProposals(req.companyId, { supplierId: req.query.supplierId, status: req.query.status }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function rejectProposal(req, res) {
  try {
    res.json(await vmiService.rejectProposal(req.companyId, req.params.id, { userId: req.user?._id, note: req.body?.note }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function convertProposal(req, res) {
  try {
    res.json(await vmiService.convertProposalToPO(req.companyId, req.params.id, { branchId: req.body?.branchId, userId: req.user?._id }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { createAgreement, listAgreements, setAgreementActive, listProposals, rejectProposal, convertProposal };
