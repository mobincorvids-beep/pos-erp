const Department = require('../models/Department');

async function list(req, res) {
  const rows = await Department.find({ companyId: req.companyId });
  res.json(rows);
}

async function create(req, res) {
  const department = await Department.create({ ...req.body, companyId: req.companyId });
  res.status(201).json(department);
}

/** Was missing, a renamed department had no way to be corrected. */
async function update(req, res) {
  const department = await Department.findOneAndUpdate(
    { _id: req.params.id, companyId: req.companyId }, { name: req.body.name }, { new: true, runValidators: true }
  );
  if (!department) return res.status(404).json({ error: 'Department not found.' });
  res.json(department);
}

/** Was missing, no way to remove a department created by mistake. Employee.departmentId
 * simply keeps its stale reference if this is ever removed while in use — same behavior as
 * every other reference field in this codebase (nothing cascades or blocks on FK use here). */
async function remove(req, res) {
  const department = await Department.findOneAndDelete({ _id: req.params.id, companyId: req.companyId });
  if (!department) return res.status(404).json({ error: 'Department not found.' });
  res.json({ ok: true });
}

module.exports = { list, create, update, remove };
