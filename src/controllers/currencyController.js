const currencyService = require('../services/currencyService');

async function setManualRate(req, res) {
  try { res.status(201).json(await currencyService.setManualRate({ ...req.body, companyId: req.companyId, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getRate(req, res) {
  try {
    const rate = await currencyService.getRate(req.companyId, req.query.from, req.query.to, req.query.date);
    res.json({ from: req.query.from.toUpperCase(), to: req.query.to.toUpperCase(), date: req.query.date || new Date().toISOString().slice(0, 10), rate });
  } catch (err) { res.status(400).json({ error: err.message }); }
}
async function convert(req, res) {
  try {
    const converted = await currencyService.convert(req.companyId, Number(req.query.amount), req.query.from, req.query.to, req.query.date);
    res.json({ amount: Number(req.query.amount), from: req.query.from.toUpperCase(), to: req.query.to.toUpperCase(), converted });
  } catch (err) { res.status(400).json({ error: err.message }); }
}
async function listRates(req, res) { res.json(await currencyService.listRates(req.companyId, req.query)); }
function listSupportedCurrencies(req, res) { res.json({ frankfurterSupported: Array.from(currencyService.FRANKFURTER_CURRENCIES).sort() }); }

module.exports = { setManualRate, getRate, convert, listRates, listSupportedCurrencies };
