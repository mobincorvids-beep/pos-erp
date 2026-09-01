const giftCardService = require('../services/giftCardService');

async function issue(req, res) {
  try {
    res.status(201).json(await giftCardService.issueGiftCard({ ...req.body, companyId: req.companyId, userId: req.auth.userId }));
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function lookup(req, res) {
  try {
    res.json(await giftCardService.lookupGiftCard(req.companyId, req.params.cardNumber));
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function redeem(req, res) {
  try {
    const card = await giftCardService.redeemGiftCard(req.companyId, req.params.cardNumber, req.body.amount, {
      saleId: req.body.saleId, userId: req.auth.userId,
    });
    res.json(card);
  } catch (err) { res.status(400).json({ error: err.message }); }
}

async function list(req, res) {
  res.json(await giftCardService.listGiftCards(req.companyId, req.query));
}

async function transactions(req, res) {
  res.json(await giftCardService.listTransactions(req.companyId, req.params.id));
}

module.exports = { issue, lookup, redeem, list, transactions };
