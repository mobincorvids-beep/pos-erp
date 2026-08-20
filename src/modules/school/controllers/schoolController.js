const schoolService = require('../services/schoolService');

async function listStudents(req, res) {
  const rows = await schoolService.listStudents(req.companyId, req.query.className || null);
  res.json(rows);
}

async function createStudent(req, res) {
  try {
    const student = await schoolService.createStudent({ ...req.body, companyId: req.companyId });
    res.status(201).json(student);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listFeeStructures(req, res) {
  const rows = await schoolService.listFeeStructures(req.companyId);
  res.json(rows);
}

async function createFeeStructure(req, res) {
  try {
    const structure = await schoolService.createFeeStructure({ ...req.body, companyId: req.companyId });
    res.status(201).json(structure);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function generateInvoices(req, res) {
  try {
    const result = await schoolService.generateFeeInvoices({ ...req.body, companyId: req.companyId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listInvoices(req, res) {
  const rows = await schoolService.listInvoices(req.companyId, req.query);
  res.json(rows);
}

async function flagOverdue(req, res) {
  const count = await schoolService.flagOverdueInvoices(req.companyId);
  res.json({ flagged: count });
}

async function payInvoice(req, res) {
  try {
    const result = await schoolService.payInvoice(req.params.id, { ...req.body, userId: req.auth.userId });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function markAttendance(req, res) {
  try {
    const attendance = await schoolService.markAttendance({ ...req.body, companyId: req.companyId });
    res.status(201).json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function attendanceForMonth(req, res) {
  const rows = await schoolService.attendanceForMonth(req.params.studentId, Number(req.query.month), Number(req.query.year));
  res.json(rows);
}

module.exports = {
  listStudents, createStudent,
  listFeeStructures, createFeeStructure,
  generateInvoices, listInvoices, flagOverdue, payInvoice,
  markAttendance, attendanceForMonth,
};
