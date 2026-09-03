const binTransferService = require('../services/binTransferService');

async function list(req, res) {
  try {
    const rows = await binTransferService.listBinTransfers(req.companyId, req.query);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  try {
    const transfer = await binTransferService.getBinTransfer(req.params.id, req.companyId);
    if (!transfer) return res.status(404).json({ error: 'Bin transfer not found.' });
    res.json(transfer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function request(req, res) {
  try {
    const transfer = await binTransferService.requestBinTransfer({
      ...req.body,
      companyId: req.companyId,
      userId: req.auth.userId,
    });
    res.status(201).json(transfer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function approve(req, res) {
  try {
    const transfer = await binTransferService.approveBinTransfer(req.params.id, req.companyId, req.auth.userId);
    res.json(transfer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reject(req, res) {
  try {
    const transfer = await binTransferService.rejectBinTransfer(req.params.id, req.companyId, req.auth.userId, req.body?.reason);
    res.json(transfer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function complete(req, res) {
  try {
    const transfer = await binTransferService.completeBinTransfer(req.params.id, req.companyId, req.auth.userId);
    res.json(transfer);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, get, request, approve, reject, complete };
