const webhookService = require('../services/webhookService');

async function subscribe(req, res) {
  try { res.status(201).json(await webhookService.subscribe({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listSubscriptions(req, res) { res.json(await webhookService.listSubscriptions(req.companyId)); }
async function unsubscribe(req, res) {
  try { res.json(await webhookService.unsubscribe(req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { subscribe, listSubscriptions, unsubscribe };
