const fabricRollService = require('../services/fabricRollService');

async function receiveRoll(req, res) {
  try {
    const roll = await fabricRollService.receiveRoll({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(roll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listRolls(req, res) {
  const rows = await fabricRollService.listRolls(req.companyId, req.query);
  res.json(rows);
}

async function cutFromRoll(req, res) {
  try {
    const roll = await fabricRollService.cutFromRoll(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(roll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateRoll(req, res) {
  try {
    const roll = await fabricRollService.updateRoll(req.params.id, req.body);
    res.json(roll);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { receiveRoll, listRolls, cutFromRoll, updateRoll };
