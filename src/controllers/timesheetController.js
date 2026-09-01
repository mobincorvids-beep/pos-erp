const timesheetService = require('../services/timesheetService');

async function logTime(req, res) {
  try { res.status(201).json(await timesheetService.logTime({ ...req.body, companyId: req.companyId })); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function listTimesheets(req, res) {
  try { res.json(await timesheetService.listTimesheets(req.companyId, req.query)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function getTimesheet(req, res) {
  try { res.json(await timesheetService.getTimesheet(req.companyId, req.params.id)); }
  catch (err) { res.status(404).json({ error: err.message }); }
}
async function updateTimesheet(req, res) {
  try { res.json(await timesheetService.updateTimesheet(req.companyId, req.params.id, req.body)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function submitTimesheet(req, res) {
  try { res.json(await timesheetService.submitTimesheet(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function approveTimesheet(req, res) {
  try { res.json(await timesheetService.approveTimesheet(req.companyId, req.params.id, req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function rejectTimesheet(req, res) {
  try { res.json(await timesheetService.rejectTimesheet(req.companyId, req.params.id, req.auth.userId, req.body.reason)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}
async function deleteTimesheet(req, res) {
  try { res.json(await timesheetService.deleteTimesheet(req.companyId, req.params.id)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = {
  logTime, listTimesheets, getTimesheet, updateTimesheet,
  submitTimesheet, approveTimesheet, rejectTimesheet, deleteTimesheet,
};
