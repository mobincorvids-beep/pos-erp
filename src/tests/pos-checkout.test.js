/**
 * Integration tests for posSaleService.checkout — the full "onboard ->
 * stock -> checkout -> ledger" flow, plus the coupon and gift-card hooks.
 *
 * Requires a real MongoDB replica set at process.env.MONGO_URI (checkout
 * runs inside a real multi-document transaction). Creates its own
 * throwaway company per file (via companyProvisioningService), same
 * pattern as src/smokeTest.js.
 */
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const connectDB = require('../config/db');

const Account = require('../models/Account');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Sale = require('../models/Sale');
const Voucher = require('../models/Voucher');
const CouponRedemption = require('../models/CouponRedemption');
const GiftCardTransaction = require('../models/GiftCardTransaction');

const companyProvisioningService = require('../services/companyProvisioningService');
const inventoryService = require('../services/inventoryService');
const posSaleService = require('../services/posSaleService');
const couponService = require('../services/couponService');
const giftCardService = require('../services/giftCardService');

let company, branch, warehouse, admin;
let cash, customer;
let suffix;

beforeAll(async () => {
  await connectDB();
  suffix = nanoid(6).toLowerCase();
  const result = await companyProvisioningService.onboardCompany({
    name: `POS Test Co ${suffix}`,
    industryType: 'retail',
    adminName: 'POS Test Admin',
    adminEmail: `pos-test-${suffix}@test.local`,
  });
  ({ company, branch, warehouse, admin } = result);

  const accounts = await Account.find({ companyId: company._id });
  cash = accounts.find((a) => /^Cash$/.test(a.name));

  customer = await Customer.create({ companyId: company._id, name: 'POS Test Customer' });
});

afterAll(async () => {
  await mongoose.connection.close();
});

/** Creates a fresh product with 100 units of opening stock at costPrice 50, sellingPrice 100. */
async function makeProduct(tag) {
  const product = await Product.create({
    companyId: company._id, name: `POS Test Widget ${tag}`, sku: `PTW-${suffix}-${tag}`,
    barcode: `${suffix}${tag}0`, trackingMode: 'simple', costPrice: 50, sellingPrice: 100,
    reorderLevel: 5, variants: [{ sku: `PTW-${suffix}-${tag}`, barcode: `${suffix}${tag}0`, sellingPrice: 100 }],
  });
  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId: product.variants[0]._id,
    type: 'purchase', quantity: 100, unitCost: 50, note: 'POS test opening stock',
  });
  return product;
}

describe('posSaleService.checkout — plain sale', () => {
  test('produces correct totals, decrements inventory, and posts a balanced voucher', async () => {
    const product = await makeProduct('plain');
    const variantId = product.variants[0]._id;

    const sale = await posSaleService.checkout({
      userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 3, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 300 }],
    });

    // subtotal = 3 * 100 = 300, no discount/tax -> totalAmount = 300
    expect(sale.status).toBe('completed');
    expect(sale.subtotal).toBe(300);
    expect(sale.totalAmount).toBe(300);
    expect(sale.paidAmount).toBe(300);
    expect(sale.dueAmount).toBe(0);

    const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
    expect(qty).toBe(97); // 100 opening - 3 sold

    // The sale's accounting effect: at least one voucher referencing this
    // sale, and every voucher tied to it individually balances.
    const vouchers = await Voucher.find({ referenceType: 'Sale', referenceId: sale._id });
    expect(vouchers.length).toBeGreaterThan(0);

    let totalDebit = 0, totalCredit = 0;
    for (const v of vouchers) {
      const d = v.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
      const c = v.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
      expect(Math.abs(d - c)).toBeLessThan(0.01); // each voucher individually balances
      totalDebit += d;
      totalCredit += c;
    }
    expect(Math.abs(totalDebit - totalCredit)).toBeLessThan(0.01);

    // The receipt voucher specifically: Dr Cash 300, Cr Sales Revenue 300.
    const receiptVoucher = vouchers.find((v) => v.type === 'receipt');
    expect(receiptVoucher).toBeTruthy();
    const cashEntry = receiptVoucher.entries.find((e) => String(e.accountId) === String(cash._id));
    expect(cashEntry.debit).toBe(300);
  });
});

describe('posSaleService.checkout — coupon', () => {
  test('applies a percent-off coupon to the sale total and records usage', async () => {
    const product = await makeProduct('coupon');
    const variantId = product.variants[0]._id;

    const coupon = await couponService.createCoupon(company._id, {
      code: `SAVE10-${suffix}`, description: '10% off', discountType: 'percent', discountValue: 10,
    });

    // subtotal = 4 * 100 = 400; 10% coupon discount = 40; total = 360
    const sale = await posSaleService.checkout({
      userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 4, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 360 }],
      couponCode: coupon.code,
    });

    expect(sale.subtotal).toBe(400);
    expect(sale.couponCode).toBe(coupon.code);
    expect(sale.couponDiscountAmount).toBe(40);
    expect(sale.totalAmount).toBe(360);
    expect(sale.dueAmount).toBe(0);

    // Coupon usage is recorded asynchronously right after the transaction
    // commits (see posSaleService's post-transaction block) — by the time
    // checkout() resolves it has already been awaited, so it should be
    // visible immediately.
    const redemption = await CouponRedemption.findOne({ couponId: coupon._id, saleId: sale._id });
    expect(redemption).toBeTruthy();
    expect(redemption.discountAmount).toBe(40);

    const reloadedCoupon = await require('../models/Coupon').findById(coupon._id);
    expect(reloadedCoupon.usageCount).toBe(1);

    // Revenue voucher entry should reflect the coupon-reduced amount:
    // Cr Sales Revenue = subtotal - discountTotal - couponDiscountAmount = 400 - 0 - 40 = 360.
    const vouchers = await Voucher.find({ referenceType: 'Sale', referenceId: sale._id, type: 'receipt' });
    const revenueEntry = vouchers[0].entries.find((e) => (e.credit || 0) > 0);
    expect(revenueEntry.credit).toBe(360);
  });
});

describe('giftCardService — issue and redeem', () => {
  test('redeeming a gift card decrements currentBalance and records a GiftCardTransaction', async () => {
    const card = await giftCardService.issueGiftCard({
      companyId: company._id, initialBalance: 500, customerId: customer._id, userId: admin._id,
    });
    expect(card.currentBalance).toBe(500);

    const issueTxn = await GiftCardTransaction.findOne({ giftCardId: card._id, type: 'issue' });
    expect(issueTxn).toBeTruthy();
    expect(issueTxn.amount).toBe(500);
    expect(issueTxn.balanceAfter).toBe(500);

    // Checkout a real sale (gift-card redemption isn't wired into
    // checkout()'s payments array in the current code — posSaleService
    // only accepts Account-based payments — so, mirroring how coupon usage
    // is recorded as a separate post-checkout step, we redeem the gift
    // card against the sale via giftCardService directly, tying it back
    // with saleId exactly as redeemGiftCard()'s signature supports).
    const product = await makeProduct('giftcard');
    const variantId = product.variants[0]._id;

    const sale = await posSaleService.checkout({
      userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 2, unitPrice: 100 }],
      // Full amount (200) paid by cash here; the gift card redemption below
      // is a partial redemption against the same sale for record-keeping,
      // independent of the Sale document's own payment totals.
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 200 }],
    });
    expect(sale.totalAmount).toBe(200);

    // Partial redemption of 150 out of the 500 balance.
    const afterPartial = await giftCardService.redeemGiftCard(company._id, card.cardNumber, 150, {
      saleId: sale._id, userId: admin._id,
    });
    expect(afterPartial.currentBalance).toBe(350);
    expect(afterPartial.status).toBe('active');

    const partialTxn = await GiftCardTransaction.findOne({ giftCardId: card._id, type: 'redeem', saleId: sale._id });
    expect(partialTxn).toBeTruthy();
    expect(partialTxn.amount).toBe(-150);
    expect(partialTxn.balanceAfter).toBe(350);

    // Full redemption of the remaining balance (350) drains the card to 0
    // and flips its status to 'redeemed'.
    const afterFull = await giftCardService.redeemGiftCard(company._id, card.cardNumber, 350, {
      saleId: sale._id, userId: admin._id,
    });
    expect(afterFull.currentBalance).toBe(0);
    expect(afterFull.status).toBe('redeemed');

    const allTxns = await GiftCardTransaction.find({ giftCardId: card._id }).sort({ createdAt: 1 });
    expect(allTxns.length).toBe(3); // issue, partial redeem, full redeem

    // Redeeming a card with no balance left must be rejected.
    await expect(
      giftCardService.redeemGiftCard(company._id, card.cardNumber, 1, { saleId: sale._id, userId: admin._id })
    ).rejects.toThrow(/no remaining balance/i);
  });
});
