/**
 * TimeEntryService — the genuinely new mechanic: work is logged now,
 * accumulates unbilled, and is swept into ONE aggregated invoice later,
 * at whatever moment someone actually generates it — not billed
 * automatically at the moment the work happens, the way every other
 * sale in this app works. generateInvoice() bills the EXACT sum of
 * (hours × that entry's own snapshotted rate) across every unbilled
 * entry, not an averaged rate applied to total hours — entries logged by
 * a senior consultant at one rate and a junior one at another correctly
 * contribute their own real amounts to the total, not a blended approximation.
 */
const TimeEntry = require('../models/TimeEntry');
const posSaleService = require('../../../services/posSaleService');

function logTime(input) {
  const { companyId, branchId, employeeId, clientCustomerId, projectId, date, description, hours, hourlyRate } = input;
  if (!hours || hours <= 0) throw new Error('hours must be greater than zero.');
  if (!hourlyRate || hourlyRate <= 0) throw new Error('hourlyRate must be greater than zero.');
  return TimeEntry.create({ companyId, branchId, employeeId, clientCustomerId, projectId: projectId || null, date, description, hours, hourlyRate });
}

function listUnbilledEntries(companyId, clientCustomerId) {
  return TimeEntry.find({ companyId, clientCustomerId, billed: false }).populate('employeeId', 'name').sort({ date: 1 });
}

/**
 * Sweeps every unbilled entry for one client into a single Sale. The
 * billed amount is the EXACT sum of each entry's own hours × its own
 * snapshotted rate — never an averaged rate times total hours, which
 * could silently diverge from the true total whenever rates differ
 * across entries (a real, easy-to-get-wrong shortcut this deliberately avoids).
 */
async function generateInvoice(companyId, clientCustomerId, { warehouseId, billingProductId, billingVariantId, paymentAccountId, posTerminalId, userId }) {
  const entries = await TimeEntry.find({ companyId, clientCustomerId, billed: false });
  if (entries.length === 0) throw new Error('No unbilled time entries exist for this client — nothing to invoice.');

  const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
  const totalAmount = Math.round(entries.reduce((sum, e) => sum + e.hours * e.hourlyRate, 0) * 100) / 100;

  const branchId = entries[0].branchId;
  const sale = await posSaleService.checkout({
    companyId, branchId, warehouseId, customerId: clientCustomerId, posTerminalId, userId,
    items: [{ productId: billingProductId, variantId: billingVariantId, quantity: 1, unitPrice: totalAmount }],
    payments: paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: totalAmount }] : [],
  });

  await TimeEntry.updateMany(
    { _id: { $in: entries.map((e) => e._id) } },
    { billed: true, saleId: sale._id }
  );

  return { sale, entriesInvoiced: entries.length, totalHours, totalAmount };
}

function listInvoicedEntries(companyId, { clientCustomerId, saleId } = {}) {
  const filter = { companyId, billed: true };
  if (clientCustomerId) filter.clientCustomerId = clientCustomerId;
  if (saleId) filter.saleId = saleId;
  return TimeEntry.find(filter).sort({ date: 1 });
}

module.exports = { logTime, listUnbilledEntries, generateInvoice, listInvoicedEntries };
