const hotelService = require('../services/hotelService');

async function listRooms(req, res) {
  const rows = await hotelService.listRooms(req.companyId, req.query.branchId || null);
  res.json(rows);
}

async function createRoom(req, res) {
  try {
    const room = await hotelService.createRoom({ ...req.body, companyId: req.companyId });
    res.status(201).json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function checkAvailability(req, res) {
  try {
    const available = await hotelService.isRoomAvailable(req.params.roomId, new Date(req.query.checkInDate), new Date(req.query.checkOutDate));
    res.json({ available });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function bookReservation(req, res) {
  try {
    const reservation = await hotelService.bookReservation({ ...req.body, companyId: req.companyId, userId: req.auth.userId });
    res.status(201).json(reservation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function listReservations(req, res) {
  const rows = await hotelService.listReservations(req.companyId, req.query);
  res.json(rows);
}

async function checkIn(req, res) {
  try {
    const reservation = await hotelService.checkIn(req.params.id);
    res.json(reservation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function addExtraCharge(req, res) {
  try {
    const reservation = await hotelService.addExtraCharge(req.params.id, req.body);
    res.status(201).json(reservation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function checkOut(req, res) {
  try {
    const result = await hotelService.checkOut(req.params.id, { ...req.body, userId: req.auth.userId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function markRoomClean(req, res) {
  try {
    const room = await hotelService.markRoomClean(req.params.roomId);
    res.json(room);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function cancelReservation(req, res) {
  try {
    const reservation = await hotelService.cancelReservation(req.params.id);
    res.json(reservation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  listRooms, createRoom, checkAvailability,
  bookReservation, listReservations, checkIn, addExtraCharge, checkOut, markRoomClean, cancelReservation,
};
