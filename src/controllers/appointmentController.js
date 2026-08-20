const Appointment = require('../models/Appointment');
const appointmentService = require('../services/appointmentService');

async function list(req, res) {
  const filter = { companyId: req.companyId };
  if (req.query.staffUserId) filter.staffUserId = req.query.staffUserId;
  if (req.query.status) filter.status = req.query.status;
  const appointments = await Appointment.find(filter).sort({ startTime: 1 }).limit(200);
  res.json(appointments);
}

async function book(req, res) {
  try {
    const appointment = await appointmentService.book({
      ...req.body, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function reschedule(req, res) {
  try {
    const appointment = await appointmentService.reschedule(req.params.id, req.body.startTime, req.body.endTime);
    res.json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateStatus(req, res) {
  try {
    const appointment = await appointmentService.updateStatus(req.params.id, req.body.status);
    res.json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function bill(req, res) {
  try {
    const result = await appointmentService.billAppointment(req.params.id, {
      ...req.body, companyId: req.companyId, userId: req.auth.userId,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function schedule(req, res) {
  try {
    const { staffUserId, from, to } = req.query;
    if (!staffUserId || !from || !to) {
      return res.status(400).json({ error: '`staffUserId`, `from`, and `to` query params are required.' });
    }
    const rows = await appointmentService.staffSchedule(staffUserId, from, to);
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = { list, book, reschedule, updateStatus, bill, schedule };
