const licensePlateService = require('../services/licensePlateService');

async function list(req, res) {
  try {
    const rows = await licensePlateService.listLicensePlates(req.companyId, req.query);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function get(req, res) {
  try {
    const plate = await licensePlateService.getLicensePlate(req.params.id);
    if (!plate || String(plate.companyId) !== String(req.companyId)) {
      return res.status(404).json({ error: 'License plate not found.' });
    }
    res.json(plate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function create(req, res) {
  try {
    const plate = await licensePlateService.createLicensePlate({
      ...req.body,
      companyId: req.companyId,
      createdBy: req.auth.userId,
    });
    res.status(201).json(plate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function addItem(req, res) {
  try {
    const plate = await licensePlateService.addItemToLicensePlate(req.params.id, req.body);
    res.json(plate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function move(req, res) {
  try {
    const plate = await licensePlateService.moveLicensePlate(req.params.id, req.body.toBinId);
    res.json(plate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function close(req, res) {
  try {
    const plate = await licensePlateService.closeLicensePlate(req.params.id);
    res.json(plate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function ship(req, res) {
  try {
    const plate = await licensePlateService.shipLicensePlate(req.params.id);
    res.json(plate);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, get, create, addItem, move, close, ship };
