/**
 * Jest config for the backend's integration test suite.
 *
 * These tests exercise real business rules (accounting balance, payroll
 * math, coupon/gift-card validation, leave-balance deduction, etc.)
 * against an ACTUAL MongoDB replica set — the same requirement
 * src/smokeTest.js has, and for the same reason: several services here
 * (posSaleService, payroll posting, credit/debit notes) use real
 * multi-document Mongo transactions, which only work on a replica set.
 *
 * Point MONGO_URI at a real, empty-is-fine replica-set MongoDB before
 * running `npm test` — see .github/workflows/ci.yml's "unit-tests" job
 * for exactly how CI provisions one (a single-node `mongo:7 --replSet
 * rs0` container). Locally, `docker compose up -d mongo` if the
 * docker-compose.yml service is configured with a replica set, or point
 * MONGO_URI at any replica-set-enabled MongoDB you have.
 *
 * Each test file creates its own throwaway company (via
 * companyProvisioningService, same as the smoke test), so the whole
 * suite is safe to run repeatedly against a shared dev database.
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/src/tests/**/*.test.js'],
  testTimeout: 30000,
  // Run suites serially (npm test already passes --runInBand) — these
  // tests share one real database and some assert on company-scoped
  // aggregate state, so parallel workers would need per-worker DBs to be
  // safe. Serial keeps the setup simple and matches how the smoke test
  // already runs (one process, one connection, straight through).
  maxWorkers: 1,
};
