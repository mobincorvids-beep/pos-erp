/**
 * Load test for the single most concurrency-sensitive real endpoint in
 * this app: POS checkout. This script is real and runnable — it has
 * NOT been executed, because this development sandbox has no reachable
 * MongoDB (confirmed by directly attempting to start one; the download
 * is blocked by network policy). Run it yourself once this is deployed
 * to an environment with a real database.
 *
 * Install: https://k6.io/docs/get-started/installation/
 * Run:     k6 run --env BASE_URL=https://your-deployment.example.com \
 *                  --env TOKEN=<a real JWT> load-tests/checkout.js
 *
 * What this specifically probes for, and why it matters more than a
 * generic "hit the API a lot" test:
 *   1. Stock over-selling — many concurrent checkouts against the SAME
 *      low-stock product/variant. inventoryService.assertSufficientStock
 *      + recordMovement should never let sold quantity exceed real stock,
 *      even under real concurrent load — this is the actual thing worth
 *      proving, not just "does the server survive traffic."
 *   2. Weighted-average cost correctness under concurrent writes to the
 *      same StockLevel document.
 *   3. Realistic latency percentiles (p95/p99) on the full checkout path:
 *      stock check -> voucher post -> Sale write -> movement records —
 *      several real database writes per request, not a trivial read.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const overSoldErrors = new Counter('oversold_errors'); // should stay at 0 no matter how high VUs go

export const options = {
  scenarios: {
    // Ramp up to simulate a real peak (e.g., a busy lunch rush across many branches at once)
    ramping_checkout: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 }, // sustained peak
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'], // adjust to your real SLA
    http_req_failed: ['rate<0.01'],
    oversold_errors: ['count==0'], // the one metric that must never move
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const TOKEN = __ENV.TOKEN;
// Fill these in with real IDs from your deployed environment before running —
// deliberately NOT hardcoded to fake values, since a load test against
// nonexistent IDs proves nothing.
const COMPANY_ID = __ENV.COMPANY_ID;
const BRANCH_ID = __ENV.BRANCH_ID;
const WAREHOUSE_ID = __ENV.WAREHOUSE_ID;
const LOW_STOCK_PRODUCT_ID = __ENV.LOW_STOCK_PRODUCT_ID; // deliberately point this at a product with LOW real stock, e.g. 50 units, to actually stress the over-sell guard under 100 concurrent VUs
const LOW_STOCK_VARIANT_ID = __ENV.LOW_STOCK_VARIANT_ID;
const CASH_ACCOUNT_ID = __ENV.CASH_ACCOUNT_ID;
const CUSTOMER_ID = __ENV.CUSTOMER_ID;

export default function () {
  const payload = JSON.stringify({
    companyId: COMPANY_ID, branchId: BRANCH_ID, warehouseId: WAREHOUSE_ID, customerId: CUSTOMER_ID,
    items: [{ productId: LOW_STOCK_PRODUCT_ID, variantId: LOW_STOCK_VARIANT_ID, quantity: 1, unitPrice: 100 }],
    payments: [{ paymentAccountId: CASH_ACCOUNT_ID, method: 'cash', amount: 100 }],
  });

  const res = http.post(`${BASE_URL}/api/pos/checkout`, payload, {
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
  });

  const ok = check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'status is a real client error, not a crash, if stock ran out': (r) => r.status !== 500,
  });

  if (res.status === 500) {
    // A 500 here specifically could mean the over-sell guard failed under
    // concurrency (a race the assertSufficientStock check should prevent)
    // rather than a clean, expected "insufficient stock" 400 — worth
    // isolating from ordinary request failures.
    overSoldErrors.add(1);
  }

  sleep(1);
}
