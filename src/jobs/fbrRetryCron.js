/**
 * FbrRetryCron — retries completed sales whose FBR Digital Invoicing
 * submission failed (Sale.fbrSubmissionError set, fbrSubmittedAt still
 * null). Runs every 15 minutes and honors fbrService.RETRY_BACKOFF_MS so a
 * sale that was just attempted isn't retried again the very next tick —
 * see fbrService.findRetryableSales for the exact query.
 *
 * Same start/stop shape as lowStockCron.js / marketingJourneyCron.js — see
 * those files' header comments for why start() must only ever be called
 * from src/server.js, not src/app.js (app.js is required by tests/scripts
 * and the Vercel serverless entrypoint, neither of which may get a
 * background timer that outlives the process/request).
 */
const cron = require('node-cron');
const fbrService = require('../services/fbrService');

let task = null;
let running = false; // reentrancy guard: skip a tick if the previous run hasn't finished

/** One sweep: attempt every currently-retryable sale, tolerating per-sale
 * failures (already recorded onto the sale itself by submitInvoice) so one
 * bad sale doesn't stop the rest of the batch. Returns a small summary. */
async function runSweep() {
  const sales = await fbrService.findRetryableSales(100);
  let succeeded = 0;
  let failed = 0;

  for (const sale of sales) {
    try {
      await fbrService.submitInvoice(sale._id);
      succeeded++;
    } catch (err) {
      failed++;
      console.error(`[fbr-retry-cron] retry failed for sale ${sale.invoiceNumber || sale._id}:`, err.message);
    }
  }

  return { attempted: sales.length, succeeded, failed };
}

function start() {
  if (task) return task; // already started — no-op, not a second timer

  // Every 15 minutes, matching fbrService.RETRY_BACKOFF_MS.
  task = cron.schedule('*/15 * * * *', async () => {
    if (running) return; // previous sweep still in flight — don't overlap
    running = true;
    try {
      const result = await runSweep();
      if (result.attempted) {
        console.log(`[fbr-retry-cron] retried ${result.attempted} sale(s): ${result.succeeded} succeeded, ${result.failed} still failing.`);
      }
    } catch (err) {
      console.error('[fbr-retry-cron] sweep threw:', err.message);
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
