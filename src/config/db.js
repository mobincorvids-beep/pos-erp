const mongoose = require('mongoose');

// Serverless platforms (Vercel) reuse a warm container's module cache
// across invocations, so a bare `mongoose.connect()` call on every request
// would either open a fresh connection each time (Atlas connection-limit
// exhaustion under load) or double-connect and throw. Caching the in-flight
// connection promise on `global` survives across invocations within the
// same warm container and is a no-op cost once connected — this branch is
// additive and never runs differently for the traditional long-lived
// process (npm start / Docker), where connectDB() is simply called once at
// boot and the cache is populated on that first (and only) call.
async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pos_erp';

  if (global._mongooseConnPromise) {
    return global._mongooseConnPromise;
  }

  // A bad URI (wrong host, firewall, typo) should fail loudly within a few
  // seconds, not hang on mongoose's much longer default server-selection
  // timeout — especially important for a container health check or a CI
  // job that needs to know quickly that something's wrong, not eventually.
  const connPromise = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then((conn) => {
      console.log(`MongoDB connected -> ${uri.replace(/\/\/[^@]+@/, '//<credentials>@')}`); // never log a URI's embedded username/password
      return conn;
    })
    .catch((err) => {
      // Don't cache a failed connection attempt — the next invocation
      // should get a fresh try instead of permanently reusing a rejected
      // promise.
      global._mongooseConnPromise = null;
      throw err;
    });

  global._mongooseConnPromise = connPromise;

  // These fire for the LIFETIME of the process, not just at startup — a
  // network blip hours into running should be visible in logs, not silent.
  mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — mongoose will attempt to reconnect automatically.'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));

  return connPromise;
}

module.exports = connectDB;
