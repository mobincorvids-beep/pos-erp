/**
 * AttendanceController — TimeTrex-style self-service clock-in/out.
 * Deliberately a NEW controller, separate from hrController.js (off-limits
 * for concurrent-work reasons — see task notes): this only calls hrService's
 * additive clockIn/clockOut/todayAttendance functions, never touching
 * anything hrController.js already owns.
 */
const hrService = require('../services/hrService');

async function clockIn(req, res) {
  try {
    const attendance = await hrService.clockIn(req.companyId, req.auth.userId);
    res.status(201).json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function clockOut(req, res) {
  try {
    const attendance = await hrService.clockOut(req.companyId, req.auth.userId);
    res.json(attendance);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function myStatus(req, res) {
  const result = await hrService.todayAttendance(req.companyId, req.auth.userId);
  res.json(result);
}

module.exports = { clockIn, clockOut, myStatus };
