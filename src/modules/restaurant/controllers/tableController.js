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

/** Edit a table's name/seats — was missing; only its status could be changed before. */
async function update(req, res) {
  const { name, seats } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (seats !== undefined) updates.seats = seats;

  const table = await Table.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId }, updates, { new: true, runValidators: true }
  );
  if (!table) return res.status(404).json({ error: 'Table not found.' });
  res.json(table);
}

/** Removes a table — refuses if it's currently occupied, since that would orphan an open order. */
async function remove(req, res) {
  const table = await Table.findOne({ _id: req.params.id, companyId: req.companyId });
  if (!table) return res.status(404).json({ error: 'Table not found.' });
  if (table.status === 'occupied') {
    return res.status(400).json({ error: 'Cannot remove an occupied table — close or cancel its order first.' });
  }
  await table.deleteOne();
  res.json({ ok: true });
}

module.exports = { list, create, updateStatus, update, remove };
