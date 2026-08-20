// Vercel serverless entrypoint. Any file under /api becomes a serverless
// function; a function exported as (req, res) is Vercel's Node.js runtime
// handler signature, and an Express app instance already satisfies that
// signature directly (Express apps are callable as (req, res)). We just
// need to make sure Mongo is connected before delegating — connectDB() is
// cached (see src/config/db.js), so calling it on every invocation is a
// cheap no-op once the container is warm.
const { validateEnv } = require('../src/config/validateEnv');
validateEnv(); // same fail-fast check as server.js — must run before the app touches a real request, once per cold start

const app = require('../src/app');
const connectDB = require('../src/config/db');

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};
