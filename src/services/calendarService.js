/**
 * CalendarService — internal staff scheduling: meetings, blocked time,
 * anything with attendees who are USERS, not customers. Genuinely
 * separate from Appointment (customer-facing, billable — see that
 * model's own note). Real notifications fire on invite/update/cancel,
 * the same "only exists because a real event happened" principle every
 * other engine in this app follows.
 */
const CalendarEvent = require('../models/CalendarEvent');
const notificationService = require('./notificationService');

async function createEvent({ companyId, title, description, organizerId, attendeeUserIds, startTime, endTime, allDay, location, meetingUrl, relatedModule, relatedRecordId }) {
  if (!title || !title.trim()) throw new Error('title is required.');
  if (new Date(endTime) <= new Date(startTime)) throw new Error('endTime must be after startTime.');

  const uniqueAttendees = [...new Set((attendeeUserIds || []).map(String))].filter((id) => id !== String(organizerId));
  const event = await CalendarEvent.create({
    companyId, title: title.trim(), description: description || '', organizerId,
    attendeeResponses: uniqueAttendees.map((userId) => ({ userId, response: 'pending' })),
    startTime, endTime, allDay: !!allDay, location: location || '', meetingUrl: meetingUrl || '',
    relatedModule: relatedModule || null, relatedRecordId: relatedRecordId || null,
  });

  for (const userId of uniqueAttendees) {
    await notificationService.notify({
      companyId, userId, type: 'calendar_invite', title: 'Meeting invite',
      message: `${title}: ${new Date(startTime).toLocaleString()}`, entityType: 'CalendarEvent', entityId: event._id,
    });
  }

  return event;
}

/** Every event a user is either organizing or invited to, within an optional date range, the merged view a personal calendar needs. */
function listEventsForUser(companyId, userId, { from, to } = {}) {
  const filter = {
    companyId, status: 'scheduled',
    $or: [{ organizerId: userId }, { 'attendeeResponses.userId': userId }],
  };
  if (from || to) {
    filter.startTime = {};
    if (from) filter.startTime.$gte = new Date(from);
    if (to) filter.startTime.$lte = new Date(to);
  }
  return CalendarEvent.find(filter).populate('organizerId', 'name').populate('attendeeResponses.userId', 'name').sort({ startTime: 1 });
}

/** Corrects a meeting's details: only the organizer may edit, and re-notifies attendees since the time/place they were told about may no longer be right. */
async function updateEvent(eventId, updates, userId) {
  const event = await CalendarEvent.findById(eventId);
  if (!event) throw new Error('Event not found.');
  if (event.status !== 'scheduled') throw new Error(`Cannot edit a "${event.status}" event.`);
  if (String(event.organizerId) !== String(userId)) throw new Error('Only the organizer can edit this event.');

  const { title, description, startTime, endTime, allDay, location, meetingUrl } = updates;
  if (title !== undefined) event.title = title;
  if (description !== undefined) event.description = description;
  if (startTime !== undefined) event.startTime = startTime;
  if (endTime !== undefined) event.endTime = endTime;
  if (allDay !== undefined) event.allDay = allDay;
  if (location !== undefined) event.location = location;
  if (meetingUrl !== undefined) event.meetingUrl = meetingUrl;
  if (new Date(event.endTime) <= new Date(event.startTime)) throw new Error('endTime must be after startTime.');

  await event.save();

  for (const a of event.attendeeResponses) {
    await notificationService.notify({
      companyId: event.companyId, userId: a.userId, type: 'calendar_update', title: 'Meeting updated',
      message: `${event.title} was updated, ${new Date(event.startTime).toLocaleString()}`, entityType: 'CalendarEvent', entityId: event._id,
    });
  }

  return event;
}

/** RSVP: any invited attendee (not the organizer, who's implicitly attending) can accept/decline. */
async function respondToEvent(eventId, userId, response) {
  if (!['accepted', 'declined'].includes(response)) throw new Error('response must be "accepted" or "declined".');
  const event = await CalendarEvent.findById(eventId);
  if (!event) throw new Error('Event not found.');
  const attendee = event.attendeeResponses.find((a) => String(a.userId) === String(userId));
  if (!attendee) throw new Error('You are not invited to this event.');
  attendee.response = response;
  await event.save();
  return event;
}

/** Cancels a meeting: only the organizer, and only while still scheduled. Attendees are notified rather than the event just silently vanishing off their calendars. */
async function cancelEvent(eventId, userId) {
  const event = await CalendarEvent.findById(eventId);
  if (!event) throw new Error('Event not found.');
  if (event.status !== 'scheduled') throw new Error(`Event already has status "${event.status}".`);
  if (String(event.organizerId) !== String(userId)) throw new Error('Only the organizer can cancel this event.');

  event.status = 'cancelled';
  await event.save();

  for (const a of event.attendeeResponses) {
    await notificationService.notify({
      companyId: event.companyId, userId: a.userId, type: 'calendar_cancelled', title: 'Meeting cancelled',
      message: `${event.title} (${new Date(event.startTime).toLocaleString()}) was cancelled`, entityType: 'CalendarEvent', entityId: event._id,
    });
  }

  return event;
}

module.exports = { createEvent, listEventsForUser, updateEvent, respondToEvent, cancelEvent };
