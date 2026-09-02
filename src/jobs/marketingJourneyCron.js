/**
 * Minimal scheduled-job mechanism for marketing journeys — this codebase
 * had no existing cron/scheduler (grepped for node-cron / setInterval
 * used as a scheduler / node-schedule: nothing), so this adds the first
 * one, deliberately scoped to just this one job rather than a generic
 * job-runner.
 *
 * IMPORTANT: start() must only be called from a real, long-running
 * process (src/server.js), never from src/app.js — app.js is required by
 * tests/scripts (e.g. `node -e "require('./src/app.js')"`, the Vercel
 * serverless entrypoint api/index.js) that must NOT spin up a background
 * timer that outlives the request or keeps a test process alive. A
 * second guard (start() is a no-op if already started) makes repeated
 * calls — e.g. a test that requires server.js more than once — safe
 * rather than stacking up duplicate timers that would double-send.
 */
const cron = require('node-cron');
const marketingJourneyService = require('../services/marketingJourneyService');

let task = null;
let running = false; // reentrancy guard: skip a tick if the previous run hasn't finished

function start() {
  if (task) return task; // already started — no-op, not a second timer

  task = cron.schedule('*/5 * * * *', async () => {
    if (running) return; // previous processDueSteps() still in flight — don't overlap
    running = true;
    try {
      const result = await marketingJourneyService.processDueSteps();
      if (result.processed || result.failed) {
        console.log(`[marketing-journey-cron] processed ${result.processed} step(s), ${result.failed} failed, ${result.scanned} scanned.`);
      }
    } catch (err) {
      console.error('[marketing-journey-cron] processDueSteps() threw:', err.message);
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

module.exports = { start, stop };
