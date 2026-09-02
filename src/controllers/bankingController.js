const bankingService = require('../services/bankingService');
const bankStatementService = require('../services/bankStatementService');

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

/** POST /banking/statement/parse: parses raw CSV text (no persistence) so the UI can show a preview before importing. */
async function parseStatement(req, res) {
  try {
    const { lines, errors } = bankStatementService.parseStatementCsv(req.body.csv);
    res.json({ lines, errors });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

/** POST /banking/reconciliations/:id/import-statement: persists previewed lines onto the reconciliation and auto-matches them against unreconciled voucher entries. */
async function importStatement(req, res) {
  try {
    const reconciliation = await bankStatementService.importStatementLines(req.params.id, req.companyId, req.body.lines);
    res.status(201).json(reconciliation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function matchLine(req, res) {
  try {
    const reconciliation = await bankStatementService.confirmLineMatch(req.params.id, req.companyId, req.params.lineId, req.body.voucherId);
    res.json(reconciliation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function noMatchLine(req, res) {
  try {
    const reconciliation = await bankStatementService.markLineNoMatch(req.params.id, req.companyId, req.params.lineId);
    res.json(reconciliation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function resetLine(req, res) {
  try {
    const reconciliation = await bankStatementService.resetLine(req.params.id, req.companyId, req.params.lineId);
    res.json(reconciliation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reconciliationSummary(req, res) {
  try {
    const summary = await bankStatementService.reconciliationSummary(req.params.id, req.companyId);
    res.json(summary);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  transfer, reverseVoucher, startReconciliation, markCleared, completeReconciliation, reconciliationDetail,
  parseStatement, importStatement, matchLine, noMatchLine, resetLine, reconciliationSummary,
};
