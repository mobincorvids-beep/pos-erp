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

test('recordMovement rejects an oversell for a normal movement type (the centralized negative-stock guard)', async () => {
  // Current balance is 120. recordMovement() itself now guards every type
  // except 'adjustment' (see the "Centralized negative-stock guard" comment
  // in inventoryService.js) — a 'sale' movement that would take stock
  // negative is rejected here, not just by the separate, opt-in
  // assertSufficientStock() pre-check.
  await expect(
    inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
      type: 'sale', quantity: -500, userId: admin._id, note: 'oversell attempt',
    })
  ).rejects.toThrow(/Insufficient stock/);

  const qtyAfterRejectedSale = await inventoryService.getStockLevel(warehouse._id, variantId);
  expect(qtyAfterRejectedSale).toBe(120); // rejected — balance unchanged
});

test('recordMovement still allows an "adjustment" movement to take stock negative — that is the one type exempt from the guard, since it is how a stocktake corrects a wrong balance', async () => {
  // Current balance is 120. An 'adjustment' of -500 is exempt from the
  // guard (see inventoryService.js), so it goes through and genuinely
  // takes the balance negative.
  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
    type: 'adjustment', quantity: -500, userId: admin._id, note: 'stocktake correction',
  });

  const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
  expect(qty).toBe(-380); // 120 - 500, genuinely negative — 'adjustment' is exempt from the guard
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
