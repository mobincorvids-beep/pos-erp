const toolRentalService = require('../services/toolRentalService');

async function checkOutRental(req, res) {
  try {
    const agreement = await toolRentalService.checkOutRental({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(agreement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listRentals(req, res) {
  const rows = await toolRentalService.listRentals(req.companyId, req.query);
  res.json(rows);
}

async function voidRental(req, res) {
  try {
    const agreement = await toolRentalService.voidRental(req.companyId, req.params.id, { userId: req.auth.userId });
    res.json(agreement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function returnRental(req, res) {
  try {
    const agreement = await toolRentalService.returnRental(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(agreement);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { checkOutRental, listRentals, voidRental, returnRental };
