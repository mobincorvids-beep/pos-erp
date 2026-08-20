/**
 * Generates sequential, human-readable document numbers (invoices, POs, vouchers)
 * scoped per company/terminal so numbering never collides across tenants.
 */
const PosTerminal = require('../models/PosTerminal');
const { nanoid } = require('nanoid');

async function nextInvoiceNumber(posTerminalId, session) {
  const terminal = await PosTerminal.findByIdAndUpdate(
    posTerminalId,
    { $inc: { lastInvoiceNumber: 1 } },
    { new: true, session }
  );
  if (!terminal) throw new Error('POS terminal not found.');
  return `${terminal.name.replace(/\s+/g, '').toUpperCase()}-${String(terminal.lastInvoiceNumber).padStart(6, '0')}`;
}

function nextDocumentNumber(prefix) {
  return `${prefix}-${nanoid(8).toUpperCase()}`;
}

module.exports = { nextInvoiceNumber, nextDocumentNumber };
