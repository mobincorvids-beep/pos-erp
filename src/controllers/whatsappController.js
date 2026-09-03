const WhatsappMessageLog = require('../models/WhatsappMessageLog');

/** Recent send attempts for the caller's company — mainly so a vendor can
 * verify their WhatsApp integration is actually working (WhatsappLogPage). */
async function listLogs(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.type) filter.type = req.query.type;

  const rows = await WhatsappMessageLog.find(filter).sort({ createdAt: -1 }).limit(200);
  res.json(rows);
}

module.exports = { listLogs };
