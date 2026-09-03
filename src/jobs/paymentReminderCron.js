/**
 * PaymentReminderCron — daily sweep for customers with an overdue
 * outstanding balance, sending a WhatsApp reminder for each. Sale has no
 * explicit due-date field (checked — only invoiceDate), so "overdue" here
 * means a completed, non-written-off sale with dueAmount > 0 whose
 * invoiceDate is older than OVERDUE_AFTER_DAYS; that's the same aging
 * convention reportingService's receivables/aging report already uses.
 *
 * Idempotent by design: before sending, it checks WhatsappMessageLog for a
 * payment_reminder already sent to that phone number today, so a customer
 * with several overdue invoices gets at most one reminder message per day,
 * not one per invoice, and a restarted/overlapping run never double-sends.
 *
 * Same start/stop shape as marketingJourneyCron.js/lowStockCron.js — see
 * marketingJourneyCron.js's header comment for why start() must only ever
 * be called from src/server.js, never src/app.js.
 */
const cron = require('node-cron');
const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const Company = require('../models/Company');
const WhatsappMessageLog = require('../models/WhatsappMessageLog');
const whatsappService = require('../services/whatsappService');

const OVERDUE_AFTER_DAYS = 30;

let task = null;
let running = false; // reentrancy guard: skip a tick if the previous run hasn't finished

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * One sweep: for every company with WhatsApp enabled, find customers with
 * an overdue outstanding balance and WhatsApp them a reminder, at most one
 * per customer per calendar day. Returns a small summary for logging/tests.
 */
async function runSweep() {
  let scanned = 0;
  let reminded = 0;
  let skippedAlreadySentToday = 0;

  const companies = await Company.find({ whatsappEnabled: true }).select('_id currency');
  if (companies.length === 0) return { scanned, reminded, skippedAlreadySentToday };

  const overdueCutoff = new Date(Date.now() - OVERDUE_AFTER_DAYS * 24 * 60 * 60 * 1000);
  const today = startOfToday();

  for (const company of companies) {
    // Aggregate outstanding balance per customer for this company — a
    // customer can have several overdue invoices, and we want one
    // combined reminder, not one per invoice.
    const overdueByCustomer = await Sale.aggregate([
      {
        $match: {
          companyId: company._id,
          customerId: { $ne: null },
          status: 'completed',
          writtenOff: { $ne: true },
          dueAmount: { $gt: 0 },
          invoiceDate: { $lte: overdueCutoff },
        },
      },
      { $group: { _id: '$customerId', totalDue: { $sum: '$dueAmount' }, invoiceCount: { $sum: 1 } } },
    ]);

    if (overdueByCustomer.length === 0) continue;
    scanned += overdueByCustomer.length;

    const customerIds = overdueByCustomer.map((r) => r._id);
    const customers = await Customer.find({ _id: { $in: customerIds } }).select('name phone');
    const customerById = new Map(customers.map((c) => [String(c._id), c]));

    for (const row of overdueByCustomer) {
      const customer = customerById.get(String(row._id));
      if (!customer || !customer.phone) continue;

      // Idempotency: skip if a payment_reminder already went to this exact
      // phone number for this company today.
      const alreadySentToday = await WhatsappMessageLog.exists({
        companyId: company._id, type: 'payment_reminder', to: customer.phone,
        status: 'sent', sentAt: { $gte: today },
      });
      if (alreadySentToday) { skippedAlreadySentToday++; continue; }

      const result = await whatsappService.sendMessage(company._id, {
        to: customer.phone,
        templateName: 'payment_reminder',
        params: [customer.name || '', String(row.totalDue), `${row.invoiceCount}`],
        type: 'payment_reminder',
      });
      if (result.success) reminded++;
    }
  }

  return { scanned, reminded, skippedAlreadySentToday };
}

function start() {
  if (task) return task; // already started — no-op, not a second timer

  // Daily at 10:00 — a reasonable business-hours time in Asia/Karachi for
  // a payment nudge, without needing a per-company timezone lookup here.
  task = cron.schedule('0 10 * * *', async () => {
    if (running) return; // previous sweep still in flight — don't overlap
    running = true;
    try {
      const result = await runSweep();
      if (result.reminded) {
        console.log(`[payment-reminder-cron] scanned ${result.scanned} overdue customer(s), sent ${result.reminded} reminder(s), skipped ${result.skippedAlreadySentToday} already reminded today.`);
      }
    } catch (err) {
      console.error('[payment-reminder-cron] sweep threw:', err.message);
    } finally {
      running = false;
    }
  });

  return task;
}

function stop() {
  if (task) {
    task.stop();
    task = null;
  }
}

module.exports = { start, stop, runSweep };
