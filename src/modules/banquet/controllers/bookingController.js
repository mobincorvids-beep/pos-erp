const bookingService = require('../services/bookingService');

async function listVenues(req, res) {
  const rows = await bookingService.listVenues(req.companyId, req.query.branchId || null);
  res.json(rows);
}

async function createVenue(req, res) {
  try {
    const venue = await bookingService.createVenue({ ...req.body, companyId: req.companyId });
    res.status(201).json(venue);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updateVenue(req, res) {
  try {
    const venue = await bookingService.updateVenue(req.companyId, req.params.venueId, req.body);
    if (!venue) return res.status(404).json({ error: 'Venue not found.' });
    res.json(venue);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deactivateVenue(req, res) {
  const venue = await bookingService.deactivateVenue(req.companyId, req.params.venueId);
  if (!venue) return res.status(404).json({ error: 'Venue not found.' });
  res.json({ ok: true });
}

async function listPackages(req, res) {
  const rows = await bookingService.listPackages(req.companyId);
  res.json(rows);
}

async function createPackage(req, res) {
  try {
    const pkg = await bookingService.createPackage({ ...req.body, companyId: req.companyId });
    res.status(201).json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function updatePackage(req, res) {
  try {
    const pkg = await bookingService.updatePackage(req.companyId, req.params.packageId, req.body);
    if (!pkg) return res.status(404).json({ error: 'Package not found.' });
    res.json(pkg);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function deactivatePackage(req, res) {
  const pkg = await bookingService.deactivatePackage(req.companyId, req.params.packageId);
  if (!pkg) return res.status(404).json({ error: 'Package not found.' });
  res.json({ ok: true });
}

async function checkAvailability(req, res) {
  try {
    const available = await bookingService.isVenueAvailable(req.params.venueId, new Date(req.query.eventDate));
    res.json({ available });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function bookEvent(req, res) {
  try {
    const booking = await bookingService.bookEvent({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listBookings(req, res) {
  const rows = await bookingService.listBookings(req.companyId, req.query);
  res.json(rows);
}

async function completeEvent(req, res) {
  try {
    const result = await bookingService.completeEvent(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelBooking(req, res) {
  try {
    const booking = await bookingService.cancelBooking(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(booking);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  listVenues, createVenue, updateVenue, deactivateVenue,
  listPackages, createPackage, updatePackage, deactivatePackage,
  checkAvailability, bookEvent, listBookings, completeEvent, cancelBooking,
};
