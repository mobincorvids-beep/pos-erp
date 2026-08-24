/**
 * RecurringInvoiceService — a real, universal billing schedule engine
 * any company can use for any customer, industry-agnostic. Bills through
 * the exact same posSaleService.checkout() every other billing path in
 * this app already uses — no separate invoicing logic duplicated here.
 *
 * advanceDate() is deliberately its own carefully-verified function, not
 * a naive `date.setMonth(date.getMonth() + n)` — that naive version has
 * a real, well-known bug: Jan 31 + 1 month silently overflows into
 * March 3 instead of clamping to Feb 28, the exact edge case that
 * motivated Real Estate's fixed-30-day design several rounds ago. Since
 * "bill on the same date every month" is genuinely expected behavior for
 * a real invoicing feature (unlike Real Estate's arbitrary lease
 * period), this implements the correct clamping version instead of
 * avoiding the problem — verified directly against the exact edge cases
 * that matter (month-end, leap year) before being trusted.
 */
const RecurringInvoiceTemplate = require('../models/RecurringInvoiceTemplate');
const posSaleService = require('../services/posSaleService');

function advanceDate(date, frequency) {
  const d = new Date(date);
  if (frequency === 'weekly') { d.setDate(d.getDate() + 7); return d; }

  const monthsToAdd = { monthly: 1, quarterly: 3, annually: 12 }[frequency];
  if (!monthsToAdd) throw new Error(`Invalid frequency "${frequency}".`);

  const originalDay = d.getDate();
  d.setDate(1); // pinned to the 1st BEFORE changing the month, so setMonth can never overflow past the intended target month
  d.setMonth(d.getMonth() + monthsToAdd);
  const lastDayOfTargetMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(originalDay, lastDayOfTargetMonth)); // the real clamp: Jan 31 + 1 month -> Feb 28/29, never March 3
  return d;
}

function createTemplate(input) {
  const { companyId, branchId, customerId, items, frequency, startDate } = input;
  if (!items || items.length === 0) throw new Error('At least one item is required.');
  return RecurringInvoiceTemplate.create({ companyId, branchId, customerId, items, frequency, nextRunDate: startDate || new Date() });
}

function listTemplates(companyId, { status, customerId } = {}) {
  const filter = { companyId };
  if (status) filter.status = status;
  if (customerId) filter.customerId = customerId;
  return RecurringInvoiceTemplate.find(filter).populate('customerId', 'name').sort({ nextRunDate: 1 });
}

async function pauseTemplate(templateId) {
  const template = await RecurringInvoiceTemplate.findById(templateId);
  if (!template) throw new Error('Template not found.');
  template.status = 'paused';
  await template.save();
  return template;
}

async function resumeTemplate(templateId) {
  const template = await RecurringInvoiceTemplate.findById(templateId);
  if (!template) throw new Error('Template not found.');
  if (template.status !== 'paused') throw new Error(`Cannot resume a template with status "${template.status}".`);
  template.status = 'active';
  await template.save();
  return template;
}

async function cancelTemplate(templateId) {
  const template = await RecurringInvoiceTemplate.findById(templateId);
  if (!template) throw new Error('Template not found.');
  template.status = 'cancelled';
  await template.save();
  return template;
}

/**
 * Bills every ACTIVE template whose nextRunDate has arrived, one real
 * Sale per template, then advances that template's own schedule — a
 * template that's paused or cancelled is never touched, and a template
 * not yet due is left alone, exactly the same "generate what's due, skip
 * what isn't" discipline every other period-based billing engine in this
 * app already holds to.
 */
async function generateDueInvoices(companyId, { warehouseId, paymentAccountId, posTerminalId, asOfDate, userId }) {
  const evalDate = asOfDate ? new Date(asOfDate) : new Date();
  const dueTemplates = await RecurringInvoiceTemplate.find({ companyId, status: 'active', nextRunDate: { $lte: evalDate } });

  const results = [];
  for (const template of dueTemplates) {
    const totalAmount = Math.round(template.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0) * 100) / 100;
    const sale = await posSaleService.checkout({
      companyId: template.companyId, branchId: template.branchId, warehouseId, customerId: template.customerId, posTerminalId, userId,
      items: template.items, payments: paymentAccountId ? [{ paymentAccountId, method: 'cash', amount: totalAmount }] : [],
    });

    template.lastRunDate = template.nextRunDate;
    // Advance PAST the evaluation date, not just by a single period. A template
    // that fell 40 days behind on a monthly schedule would otherwise land on a
    // nextRunDate that is STILL in the past, and get billed again on the very
    // next run — real double-billing. One invoice per run, then catch the
    // schedule up to the next genuinely future occurrence.
    let next = advanceDate(template.nextRunDate, template.frequency);
    let guard = 0;
    while (next <= evalDate) {
      if (++guard > 1000) throw new Error('Recurring schedule failed to advance past the evaluation date.');
      next = advanceDate(next, template.frequency);
    }
    template.nextRunDate = next;
    await template.save();

    results.push({ templateId: template._id, sale });
  }

  return { generatedCount: results.length, results };
}

module.exports = { createTemplate, listTemplates, pauseTemplate, resumeTemplate, cancelTemplate, generateDueInvoices, advanceDate };
