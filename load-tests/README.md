# Load Testing

## The honest state of this

This script has **never been run**. This development sandbox has no reachable MongoDB — confirmed by directly attempting to start one (both a local install and an in-memory test instance); the binary download is blocked by this environment's network policy, which only permits package registries, not arbitrary external hosts. Every "backend fully verified" claim made throughout this project's development has been a syntax check and a full `require()` walk of every file — the code parses and every module loads cleanly — never an actual execution against a live database. That's a real, meaningful form of verification, but it is not the same thing as load testing, and it's important not to blur the two.

## What's here

`checkout.js` — a real, runnable [k6](https://k6.io) script targeting `POST /api/pos/checkout`, the single most concurrency-sensitive endpoint in this app. It specifically probes for stock over-selling under concurrent load (many simultaneous checkouts against one low-stock item), not just generic throughput — that's the actual risk worth measuring for a POS system, more than raw requests/second.

## To actually run it

1. Deploy this app somewhere with a real, reachable MongoDB.
2. Seed real data — a company, branch, warehouse, a product with deliberately low stock (e.g. 50 units), a cash account, a customer.
3. Install k6.
4. `k6 run --env BASE_URL=... --env TOKEN=... --env COMPANY_ID=... [...other IDs] load-tests/checkout.js`
5. Watch `oversold_errors` specifically — it should read `0` throughout. If it doesn't, that's a genuine concurrency bug in `inventoryService`, not a load-test artifact.

## Before trusting any load test result

The smoke test (`npm run smoke-test`) also requires `MONGO_URI` and has never been executed in this sandbox for the same reason. Run it first, against a real database, before running the load test — confirming correctness under a single request matters more than confirming survival under many concurrent ones, and the smoke test is what actually checks correctness.
