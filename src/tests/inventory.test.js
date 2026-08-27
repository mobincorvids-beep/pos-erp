/**
 * Integration tests for inventoryService.recordMovement — the single point
 * of truth for stock level changes (see the doc comment in
 * src/services/inventoryService.js). Runs against a real MongoDB, same
 * bootstrap pattern as src/smokeTest.js: a fresh throwaway company/warehouse.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { nanoid } = require('nanoid');

const Product = require('../models/Product');
const StockLevel = require('../models/StockLevel');

const companyProvisioningService = require('../services/companyProvisioningService');
const inventoryService = require('../services/inventoryService');

let company, branch, warehouse, admin, product, variantId;

beforeAll(async () => {
  await connectDB();
  const suffix = nanoid(6).toLowerCase();

  ({ company, branch, warehouse, admin } = await companyProvisioningService.onboardCompany({
    name: `Inventory Test Co ${suffix}`, industryType: 'retail',
    adminName: 'Inventory Admin', adminEmail: `inv-${suffix}@test.local`,
  }));

  product = await Product.create({
    companyId: company._id, name: 'Inventory Widget', sku: `INV-${suffix}`, barcode: `${suffix}222`,
    trackingMode: 'simple', costPrice: 10, sellingPrice: 25, reorderLevel: 5,
    variants: [{ sku: `INV-${suffix}`, barcode: `${suffix}222`, sellingPrice: 25 }],
  });
  variantId = product.variants[0]._id;
});

afterAll(async () => {
  await mongoose.connection.close();
});

test('a purchase-in movement establishes exact quantity and weighted-average cost', async () => {
  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
    type: 'purchase', quantity: 100, unitCost: 10, userId: admin._id, note: 'first purchase',
  });

  const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
  expect(qty).toBe(100);
  const avgCost = await inventoryService.getAvgCost(warehouse._id, variantId);
  expect(avgCost).toBe(10);
});

test('a second purchase-in at a different cost recomputes the weighted average exactly', async () => {
  // existing: 100 @ 10 = 1000. incoming: 50 @ 16 = 800. new avg = 1800 / 150 = 12
  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
    type: 'purchase', quantity: 50, unitCost: 16, userId: admin._id, note: 'second purchase, higher cost',
  });

  const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
  expect(qty).toBe(150);
  const avgCost = await inventoryService.getAvgCost(warehouse._id, variantId);
  expect(avgCost).toBe(12);
});

test('a sale-out movement decrements quantity by exactly the amount sold and leaves avgCost unchanged', async () => {
  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
    type: 'sale', quantity: -30, userId: admin._id, note: 'sale out',
  });

  const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
  expect(qty).toBe(120); // 150 - 30
  const avgCost = await inventoryService.getAvgCost(warehouse._id, variantId);
  expect(avgCost).toBe(12); // outgoing movements never touch avgCost
});

test('recordMovement rejects a zero-quantity movement', async () => {
  await expect(
    inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
      type: 'adjustment', quantity: 0, userId: admin._id,
    })
  ).rejects.toThrow(/quantity must be non-zero/);
});

test('recordMovement does NOT itself prevent stock from going negative — it just records the movement (assertSufficientStock is the separate, opt-in guard)', async () => {
  // Current balance is 120. Recording a sale of -500 units is not blocked by
  // recordMovement itself (no guard exists in it — see inventoryService.js);
  // negative-stock prevention, where it exists, is the caller's
  // responsibility via assertSufficientStock().
  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
    type: 'sale', quantity: -500, userId: admin._id, note: 'oversell attempt',
  });

  const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
  expect(qty).toBe(-380); // 120 - 500, genuinely negative — recordMovement allowed it
});

test('assertSufficientStock throws when the requested quantity exceeds what is available', async () => {
  // Balance is currently -380 (from the prior test), so any positive
  // requested quantity must fail this check.
  await expect(
    inventoryService.assertSufficientStock(warehouse._id, variantId, null, 1)
  ).rejects.toThrow(/Insufficient stock/);
});

test('assertSufficientStock accounts for reservedQuantity — reserved units are unavailable for a new commitment', async () => {
  // Bring stock to a clean positive number for this scenario.
  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
    type: 'adjustment', quantity: 400, unitCost: 12, userId: admin._id, note: 'restock for reservation test',
  });
  const qtyBefore = await inventoryService.getStockLevel(warehouse._id, variantId);
  expect(qtyBefore).toBe(20); // -380 + 400

  await inventoryService.reserve(warehouse._id, variantId, null, 15);
  const level = await StockLevel.findOne({ warehouseId: warehouse._id, variantId });
  expect(level.reservedQuantity).toBe(15);

  // 20 on hand, 15 reserved -> 5 available. Requesting 6 must fail.
  await expect(
    inventoryService.assertSufficientStock(warehouse._id, variantId, null, 6)
  ).rejects.toThrow(/available 5/);

  // Requesting exactly the 5 available must succeed (resolves without throwing).
  await expect(
    inventoryService.assertSufficientStock(warehouse._id, variantId, null, 5)
  ).resolves.toBeUndefined();

  await inventoryService.releaseReservation(warehouse._id, variantId, null, 15);
  const levelAfter = await StockLevel.findOne({ warehouseId: warehouse._id, variantId });
  expect(levelAfter.reservedQuantity).toBe(0);
});
