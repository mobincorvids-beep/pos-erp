const mongoose = require('mongoose');

// Serverless (Vercel) invocations can run concurrently and get a fresh
// module scope on every cold start, so caching purely on a local module
// variable isn't enough to prevent connection-storming Atlas — stash the
// in-flight/resolved connection promise on `global` too, so a warm
// container reusing this module instance (or a bundler that reloads it)
// still finds the same cached promise. This is purely additive: for
// `npm start`/Docker (one process, one call to connectDB() at boot) it
// behaves exactly as before — connect once, resolve once.
let cached = global._mongooseConnPromise;

async function connectDB() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/pos_erp';

  // Already connected — nothing to do. Covers the common warm-serverless
  // -container case where a previous invocation already finished
  // connecting.
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  // A connection attempt is already in flight (either from this
  // invocation or a concurrent one sharing the same warm container/global)
  // — await that instead of racing it with a second connect() call.
  if (cached) return cached;

  // A bad URI (wrong host, firewall, typo) should fail loudly within a few
  // seconds, not hang on mongoose's much longer default server-selection
  // timeout — especially important for a container health check or a CI
  // job that needs to know quickly that something's wrong, not eventually.
  cached = mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 }).then((conn) => {
    console.log(`MongoDB connected -> ${uri.replace(/\/\/[^@]+@/, '//<credentials>@')}`); // never log a URI's embedded username/password

    // These fire for the LIFETIME of the process, not just at startup — a
    // network blip hours into running should be visible in logs, not silent.
    mongoose.connection.on('error', (err) => console.error('MongoDB connection error:', err.message));
    mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected — mongoose will attempt to reconnect automatically.'));
    mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected.'));

    return conn;
  }).catch((err) => {
    // Don't leave a rejected promise cached — the next invocation/request
    // should be allowed to retry the connection instead of being stuck
    // forever replaying the same failure.
    cached = undefined;
    global._mongooseConnPromise = undefined;
    throw err;
  });

  global._mongooseConnPromise = cached;
  return cached;
}

module.exports = connectDB;
