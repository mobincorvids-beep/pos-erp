const earlyPaymentDiscountService = require('../services/earlyPaymentDiscountService');

async function setDiscountTerms(req, res) {
  try { res.json(await earlyPaymentDiscountService.setDiscountTerms(req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function calculateDiscount(req, res) {
  try { res.json(await earlyPaymentDiscountService.calculateDiscount(req.params.id, req.query.paymentDate ? new Date(req.query.paymentDate) : new Date())); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function payWithEarlyDiscount(req, res) {
  try { res.status(201).json(await earlyPaymentDiscountService.payWithEarlyDiscount(req.params.id, { ...req.body, userId: req.auth.userId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
module.exports = { setDiscountTerms, calculateDiscount, payWithEarlyDiscount };
