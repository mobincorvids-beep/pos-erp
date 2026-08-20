const bankingService = require('../services/bankingService');

async function transfer(req, res) {
  try {
    const voucher = await bankingService.transferBetweenAccounts({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(voucher);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reverseVoucher(req, res) {
  try {
    const reversal = await bankingService.reverseVoucher(req.params.voucherId, { userId: req.auth.userId, reason: req.body.reason });
    res.status(201).json(reversal);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function startReconciliation(req, res) {
  try {
    const reconciliation = await bankingService.startReconciliation({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(reconciliation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function markCleared(req, res) {
  try {
    const reconciliation = await bankingService.markCleared(req.params.id, req.body.voucherIds);
    res.json(reconciliation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function completeReconciliation(req, res) {
  try {
    const reconciliation = await bankingService.completeReconciliation(req.params.id);
    res.json(reconciliation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reconciliationDetail(req, res) {
  try {
    const detail = await bankingService.reconciliationDetail(req.params.id);
    res.json(detail);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { transfer, reverseVoucher, startReconciliation, markCleared, completeReconciliation, reconciliationDetail };
