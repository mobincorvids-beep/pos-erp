const Table = require('../models/Table');

async function list(req, res) {
  const tables = await Table.find({ companyId: req.companyId });
  res.json(tables);
}

/** Was missing entirely — a company had no way to create a table through the API at all, only list and update-status on ones that didn't exist yet. */
async function create(req, res) {
  try {
    const { branchId, name, seats } = req.body;
    if (!branchId || !name) throw new Error('branchId and name are required.');
    const table = await Table.create({ companyId: req.companyId, branchId, name, seats: seats || 4 });
    res.status(201).json(table);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateStatus(req, res) {
  const table = await Table.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId },
    { status: req.body.status },
    { new: true }
  );
  if (!table) return res.status(404).json({ error: 'Table not found.' });
  res.json(table);
}

module.exports = { list, create, updateStatus };
