require('dotenv').config();
const { validateEnv } = require('./config/validateEnv');
validateEnv(); // refuses to start rather than run with a missing/insecure JWT_SECRET or MONGO_URI — see that file for why

const app = require('./app');
const connectDB = require('./config/db');
const marketingJourneyCron = require('./jobs/marketingJourneyCron');
const lowStockCron = require('./jobs/lowStockCron');

const PORT = process.env.PORT || 4000;

let server;
connectDB()
  .then(() => {
    server = app.listen(PORT, () => console.log(`POS/ERP API running on port ${PORT}`));
    // Started here, not app.js — app.js is required by tests/scripts and
    // the Vercel serverless entrypoint (api/index.js), which must NOT get
    // a background timer that outlives a single request/process. See
    // marketingJourneyCron.js's header comment for the full reasoning.
    marketingJourneyCron.start();
    lowStockCron.start();
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

// Graceful shutdown — a container orchestrator (Kubernetes, ECS, a plain
// `systemctl restart`) sends SIGTERM before killing the process during a
// deploy. Without handling it, in-flight requests get dropped mid-response
// instead of being allowed to finish; this stops accepting new connections,
// lets existing ones complete, then closes the DB connection cleanly.
function gracefulShutdown(signal) {
  console.log(`\n${signal} received — shutting down gracefully.`);
  marketingJourneyCron.stop();
  lowStockCron.stop();
  if (!server) return process.exit(0);
  server.close(() => {
    require('mongoose').connection.close(false).then(() => {
      console.log('Shutdown complete.');
      process.exit(0);
    });
  });
  // Don't hang forever if something's stuck holding a connection open.
  setTimeout(() => { console.error('Forced shutdown after timeout.'); process.exit(1); }, 10000).unref();
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
