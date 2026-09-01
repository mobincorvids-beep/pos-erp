/**
 * TicketService — a real, universal Helpdesk any company can turn on,
 * generalizing the "submit -> assign -> resolve" shape Housing Society's
 * SocietyComplaint already proved, but adding the genuinely new piece:
 * a real, time-based SLA. slaDueAt is computed once at creation from the
 * priority's own response-time target (never recomputed later, even if
 * priority changes — a snapshot of the terms at the moment they mattered,
 * the same convention prices and exchange rates already use elsewhere in
 * this app). Breach is checked once, permanently, at the actual moment of
 * first response — not recomputed against "now" every time someone looks
 * at the ticket, which would make an already-met SLA retroactively look
 * breached just because more time has since passed.
 */
const Ticket = require('../models/Ticket');

const SLA_HOURS = { emergency: 1, high: 4, medium: 24, low: 72 };
const MS_PER_HOUR = 60 * 60 * 1000;

function createTicket(input) {
  const { companyId, branchId, customerId, raisedByUserId, category, subject, description, priority } = input;
  if (!SLA_HOURS[priority]) throw new Error(`Invalid priority "${priority}".`);
  if (!customerId && !raisedByUserId) throw new Error('Either customerId or raisedByUserId is required.');

  const slaDueAt = new Date(Date.now() + SLA_HOURS[priority] * MS_PER_HOUR);
  return Ticket.create({ companyId, branchId, customerId, raisedByUserId, category, subject, description, priority, slaDueAt });
}

function listTickets(companyId, { status, priority, assignedToUserId, slaBreached } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (priority) filter.priority = priority;
  if (assignedToUserId) filter.assignedToUserId = assignedToUserId;
  if (slaBreached !== undefined) filter.slaBreached = slaBreached;
  return Ticket.find(filter).sort({ createdAt: -1 });
}

/**
 * The real SLA check — happens exactly once, at the actual moment of
 * first response, comparing that real timestamp against the due date
 * computed at creation. Once set, slaBreached never changes again, even
 * if the ticket is reassigned later — the SLA was already met or missed
 * at the moment that mattered.
 */
async function assignTicket(ticketId, { assignedToUserId }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status !== 'open') throw new Error(`Cannot assign a ticket with status "${ticket.status}".`);

  ticket.assignedToUserId = assignedToUserId;
  ticket.status = 'assigned';
  if (!ticket.firstRespondedAt) {
    ticket.firstRespondedAt = new Date();
    ticket.slaBreached = ticket.firstRespondedAt > ticket.slaDueAt;
  }
  await ticket.save();
  return ticket;
}

async function resolveTicket(ticketId, { resolutionNote }) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status !== 'assigned') throw new Error(`Cannot resolve a ticket with status "${ticket.status}": it must be assigned first.`);
  ticket.status = 'resolved';
  ticket.resolutionNote = resolutionNote;
  ticket.resolvedAt = new Date();
  await ticket.save();
  return ticket;
}

async function closeTicket(ticketId) {
  const ticket = await Ticket.findById(ticketId);
  if (!ticket) throw new Error('Ticket not found.');
  if (ticket.status !== 'resolved') throw new Error(`Cannot close a ticket with status "${ticket.status}": it must be resolved first.`);
  ticket.status = 'closed';
  await ticket.save();
  return ticket;
}

/** Real compliance math: the actual percentage of RESPONDED-TO tickets that met their SLA, broken down by priority, not a guess, not an average of averages. */
async function slaComplianceReport(companyId) {
  const responded = await Ticket.find({ companyId, firstRespondedAt: { $ne: null } });
  const byPriority = {};
  for (const priority of Object.keys(SLA_HOURS)) {
    const inPriority = responded.filter((t) => t.priority === priority);
    const met = inPriority.filter((t) => t.slaBreached === false).length;
    byPriority[priority] = {
      total: inPriority.length, met, breached: inPriority.length - met,
      complianceRate: inPriority.length > 0 ? Math.round((met / inPriority.length) * 10000) / 100 : null,
    };
  }
  const totalResponded = responded.length;
  const totalMet = responded.filter((t) => t.slaBreached === false).length;
  return { byPriority, overall: { total: totalResponded, met: totalMet, breached: totalResponded - totalMet, complianceRate: totalResponded > 0 ? Math.round((totalMet / totalResponded) * 10000) / 100 : null } };
}

module.exports = { createTicket, listTickets, assignTicket, resolveTicket, closeTicket, slaComplianceReport, SLA_HOURS };
