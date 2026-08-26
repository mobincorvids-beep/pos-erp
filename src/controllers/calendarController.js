const calendarService = require('../services/calendarService');

async function createEvent(req, res) {
  try {
    const event = await calendarService.createEvent({ ...req.body, companyId: req.companyId, organizerId: req.auth.userId });
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listEvents(req, res) {
  const events = await calendarService.listEventsForUser(req.companyId, req.auth.userId, { from: req.query.from, to: req.query.to });
  res.json(events);
}

async function updateEvent(req, res) {
  try { res.json(await calendarService.updateEvent(req.params.id, req.body, req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function respondToEvent(req, res) {
  try { res.json(await calendarService.respondToEvent(req.params.id, req.auth.userId, req.body.response)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

async function cancelEvent(req, res) {
  try { res.json(await calendarService.cancelEvent(req.params.id, req.auth.userId)); }
  catch (err) { res.status(400).json({ error: err.message }); }
}

module.exports = { createEvent, listEvents, updateEvent, respondToEvent, cancelEvent };
