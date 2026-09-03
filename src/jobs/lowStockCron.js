/**
 * LowStockCron — hourly sweep for products at/below their reorder point,
 * complementing (not replacing) inventoryService.checkLowStockAndNotify's
 * per-sale check. That per-sale check only fires the instant a sale takes
 * stock below the threshold and dedupes against an unread Notification —
 * it won't catch a product that arrived low via a stock count/adjustment,
 * or re-alert once someone reads/clears the earlier notification while the
 * product is still low. This job re-scans every StockLevel against
 * Product.reorderLevel (or a warehouse-specific ReorderRule.minQty when one
 * exists) and notifies once per product+warehouse per calendar day, tracked
 * via StockLevel.lastAlertedAt rather than notification-read state.
 *
 * Same start/stop shape as marketingJourneyCron.js — see that file's header
 * comment for why start() must only ever be called from src/server.js, not
 * src/app.js (app.js is required by tests/scripts and the Vercel
 * serverless entrypoint, neither of which may get a background timer that
 * outlives the process/request).
 */
const cron = require('node-cron');
const StockLevel = require('../models/StockLevel');
const Product = require('../models/Product');
const ReorderRule = require('../models/ReorderRule');
const Role = require('../models/Role');
const notificationService = require('../services/notificationService');
const { INVENTORY_ADJUST } = require('../constants/permissions');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

let task = null;
let running = false; // reentrancy guard: skip a tick if the previous run hasn't finished

/**
 * One sweep: for every stock line with quantity > 0 tracked reorder point
 * that's at/below it, notify roles that can act (INVENTORY_ADJUST) once per
 * product+warehouse per rolling 24h. Returns a small summary for logging/tests.
 */
async function runSweep() {
  let scanned = 0;
  let notified = 0;

  // Only lines that actually carry stock are worth scanning — a line at 0
  // with no reorder configured, or already above threshold, is skipped
  // below without a query per line.
  const levels = await StockLevel.find({}).lean();
  if (levels.length === 0) return { scanned, notified };

  // Batch-load products and warehouse-specific reorder rules once instead
  // of a query per stock line — a company can have thousands of lines.
  const productIds = [...new Set(levels.map((l) => String(l.productId)))];
  const products = await Product.find({ _id: { $in: productIds } })
    .select('companyId name reorderLevel variants').lean();
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const rules = await ReorderRule.find({ isActive: true, productId: { $in: productIds } }).lean();
  const ruleByKey = new Map(rules.map((r) => [`${r.warehouseId}:${r.productId}`, r]));

  // Roles with inventory-write permission per company — the same audience
  // inventoryService.checkLowStockAndNotify already targets.
  const roleCache = new Map(); // companyId -> [roleId,...]
  async function rolesFor(companyId) {
    const key = String(companyId);
    if (roleCache.has(key)) return roleCache.get(key);
    const roles = await Role.find({ companyId, permissions: { $in: [INVENTORY_ADJUST, 'inventory.*', '*'] } }).select('_id');
    const ids = roles.map((r) => r._id);
    roleCache.set(key, ids);
    return ids;
  }

  const now = new Date();

  for (const level of levels) {
    const product = productById.get(String(level.productId));
    if (!product) continue;

    const rule = ruleByKey.get(`${level.warehouseId}:${level.productId}`);
    const threshold = rule ? rule.minQty : product.reorderLevel;
    if (!threshold || threshold <= 0) continue; // no reorder point configured — nothing to check

    scanned++;
    if (level.quantity > threshold) continue; // still above threshold

    // Dedupe: skip if this exact stock line was already alerted within the
    // last 24h, so an hourly cron doesn't spam an already-known low item.
    if (level.lastAlertedAt && (now - new Date(level.lastAlertedAt)) < ONE_DAY_MS) continue;

    const roleIds = await rolesFor(product.companyId);
    if (roleIds.length === 0) continue; // no one to notify — nothing to send, still mark alerted below? No: leave unmarked so a role added later still gets caught next tick.

    const variant = product.variants?.find((v) => String(v._id) === String(level.variantId));

    for (const roleId of roleIds) {
      await notificationService.notify({
        companyId: product.companyId, roleId, type: 'low_stock',
        title: `Low stock: ${product.name}${variant?.sku ? ` (${variant.sku})` : ''}`,
        message: `Only ${level.quantity} remaining, at or below the reorder level of ${threshold}.`,
        entityType: 'Product', entityId: product._id,
      });
    }

    await StockLevel.updateOne({ _id: level._id }, { lastAlertedAt: now });
    notified++;
  }

  return { scanned, notified };
}

function start() {
  if (task) return task; // already started — no-op, not a second timer

  task = cron.schedule('0 * * * *', async () => {
    if (running) return; // previous sweep still in flight — don't overlap
    running = true;
    try {
      const result = await runSweep();
      if (result.notified) {
        console.log(`[low-stock-cron] scanned ${result.scanned} stock line(s), sent ${result.notified} alert(s).`);
      }
    } catch (err) {
      console.error('[low-stock-cron] sweep threw:', err.message);
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
