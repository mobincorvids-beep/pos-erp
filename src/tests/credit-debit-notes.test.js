/**
 * Integration tests for creditNoteService and debitNoteService — the formal
 * accounting-document issuance flows (as distinct from a physical
 * saleReturnService return). Runs against a real MongoDB replica set
 * (multi-document transactions), following the same bootstrap pattern as
 * src/smokeTest.js: onboard a throwaway company, use its starter chart of
 * accounts, never touch shared/seeded data.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { nanoid } = require('nanoid');

const Account = require('../models/Account');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Voucher = require('../models/Voucher');
const PurchaseOrder = require('../models/PurchaseOrder');

const companyProvisioningService = require('../services/companyProvisioningService');
const inventoryService = require('../services/inventoryService');
const posSaleService = require('../services/posSaleService');
const purchaseService = require('../services/purchaseService');
const creditNoteService = require('../services/creditNoteService');
const debitNoteService = require('../services/debitNoteService');

let company, branch, warehouse, admin;
let cash, revenueAcc, receivableAcc, payableAcc, inventoryAcc;
let product, variantId, customer, supplier;
let sale;

beforeAll(async () => {
  await connectDB();
  const suffix = nanoid(6).toLowerCase();

  ({ company, branch, warehouse, admin } = await companyProvisioningService.onboardCompany({
    name: `CN/DN Test Co ${suffix}`, industryType: 'retail',
    adminName: 'CNDN Admin', adminEmail: `cndn-${suffix}@test.local`,
  }));

  const accounts = await Account.find({ companyId: company._id });
  const byName = (re) => accounts.find((a) => re.test(a.name));
  cash = byName(/^Cash$/);
  revenueAcc = byName(/Sales Revenue/);
  receivableAcc = byName(/Receivable/);
  payableAcc = byName(/Accounts Payable/);
  inventoryAcc = byName(/Inventory/);

  product = await Product.create({
    companyId: company._id, name: 'CNDN Widget', sku: `CNDN-${suffix}`, barcode: `${suffix}111`,
    trackingMode: 'simple', costPrice: 40, sellingPrice: 100, reorderLevel: 5,
    variants: [{ sku: `CNDN-${suffix}`, barcode: `${suffix}111`, sellingPrice: 100 }],
  });
  variantId = product.variants[0]._id;

  await inventoryService.recordMovement({
    companyId: company._id, warehouseId: warehouse._id, productId: product._id, variantId,
    type: 'purchase', quantity: 50, unitCost: 40, note: 'opening stock',
  });

  customer = await Customer.create({ companyId: company._id, name: 'CNDN Customer' });
  supplier = await Supplier.create({ companyId: company._id, name: 'CNDN Supplier' });

  sale = await posSaleService.checkout({
    userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
    customerId: customer._id,
    items: [{ productId: product._id, variantId, quantity: 4, unitPrice: 100 }],
    payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 400 }],
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});

/** Sum debit/credit entries on the voucher(s) posted against a given reference. */
async function vouchersFor(referenceType, referenceId) {
  return Voucher.find({ companyId: company._id, referenceType, referenceId }).sort({ createdAt: 1 });
}

describe('creditNoteService', () => {
  test('sale total is 400 (sanity check on bootstrap)', () => {
    expect(sale.totalAmount).toBe(400);
  });

  test('rejects a credit note amount exceeding the invoice total', async () => {
    await expect(
      creditNoteService.issueCreditNote({
        companyId: company._id, customerId: customer._id, saleId: sale._id,
        amount: 500, reason: 'too much', userId: admin._id,
      })
    ).rejects.toThrow(/exceeds the invoice total/);
  });

  test('issues a partial credit note and posts a balanced Dr Revenue / Cr AR voucher', async () => {
    const note = await creditNoteService.issueCreditNote({
      companyId: company._id, customerId: customer._id, saleId: sale._id,
      amount: 150, reason: 'goodwill adjustment', userId: admin._id,
    });

    expect(note.amount).toBe(150);
    expect(note.status).toBe('issued');
    expect(String(note.customerId)).toBe(String(customer._id));
    expect(String(note.saleId)).toBe(String(sale._id));
    expect(note.noteNumber).toMatch(/^CN/);

    const vouchers = await vouchersFor('CreditNote', note._id);
    expect(vouchers).toHaveLength(1);
    const [voucher] = vouchers;
    const totalDebit = voucher.entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + (e.credit || 0), 0);
    expect(totalDebit).toBe(150);
    expect(totalCredit).toBe(150);

    const revenueEntry = voucher.entries.find((e) => String(e.accountId) === String(revenueAcc._id));
    const arEntry = voucher.entries.find((e) => String(e.accountId) === String(receivableAcc._id));
    expect(revenueEntry.debit).toBe(150);
    expect(revenueEntry.credit).toBe(0);
    expect(arEntry.credit).toBe(150);
    expect(arEntry.debit).toBe(0);

    // stash on module-scope for the void test below
    global.__creditNoteId = note._id;
  });

  test('voiding the credit note posts a reversing entry and flips status to void', async () => {
    const noteId = global.__creditNoteId;
    const voided = await creditNoteService.voidCreditNote(noteId, {
      companyId: company._id, userId: admin._id, reason: 'issued in error',
    });
    expect(voided.status).toBe('void');
    expect(voided.voidReason).toBe('issued in error');

    const vouchers = await vouchersFor('CreditNote', noteId);
    // original issuance voucher + the reversing voucher
    expect(vouchers).toHaveLength(2);
    const reversal = vouchers[1];
    const totalDebit = reversal.entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = reversal.entries.reduce((s, e) => s + (e.credit || 0), 0);
    expect(totalDebit).toBe(150);
    expect(totalCredit).toBe(150);

    const arEntry = reversal.entries.find((e) => String(e.accountId) === String(receivableAcc._id));
    const revenueEntry = reversal.entries.find((e) => String(e.accountId) === String(revenueAcc._id));
    expect(arEntry.debit).toBe(150);
    expect(revenueEntry.credit).toBe(150);
  });

  test('cannot void an already-void credit note', async () => {
    await expect(
      creditNoteService.voidCreditNote(global.__creditNoteId, { companyId: company._id, userId: admin._id })
    ).rejects.toThrow(/already void/);
  });
});

describe('debitNoteService', () => {
  let po;

  beforeAll(async () => {
    const created = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      items: [{ productId: product._id, variantId, quantityOrdered: 20, unitCost: 45 }],
      userId: admin._id,
    });
    po = await purchaseService.decidePurchaseOrder(created._id, { approve: true, userId: admin._id });
    await purchaseService.receiveGoods({
      purchaseOrderId: po._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: po.items[0]._id, productId: product._id, variantId, quantity: 20, unitCost: 45 }],
      userId: admin._id,
    });
    po = await PurchaseOrder.findById(po._id);
  });

  test('PO total/due are 900 after full receipt (sanity check on bootstrap)', () => {
    expect(po.totalAmount).toBe(900);
    expect(po.dueAmount).toBe(900);
  });

  test('rejects a debit note amount exceeding the purchase order total', async () => {
    await expect(
      debitNoteService.issueDebitNote({
        companyId: company._id, supplierId: supplier._id, purchaseOrderId: po._id,
        amount: 1000, reason: 'too much', userId: admin._id,
      })
    ).rejects.toThrow(/exceeds the purchase order total/);
  });

  test('issues a debit note, posts a balanced Dr AP / Cr Inventory voucher, and reduces PO dueAmount', async () => {
    const note = await debitNoteService.issueDebitNote({
      companyId: company._id, supplierId: supplier._id, purchaseOrderId: po._id,
      amount: 200, reason: 'short shipment credit', userId: admin._id,
    });

    expect(note.amount).toBe(200);
    expect(note.status).toBe('issued');
    expect(String(note.supplierId)).toBe(String(supplier._id));
    expect(note.noteNumber).toMatch(/^DN/);

    const vouchers = await vouchersFor('DebitNote', note._id);
    expect(vouchers).toHaveLength(1);
    const [voucher] = vouchers;
    const totalDebit = voucher.entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + (e.credit || 0), 0);
    expect(totalDebit).toBe(200);
    expect(totalCredit).toBe(200);

    const apEntry = voucher.entries.find((e) => String(e.accountId) === String(payableAcc._id));
    const expEntry = voucher.entries.find((e) => String(e.accountId) === String(inventoryAcc._id));
    expect(apEntry.debit).toBe(200);
    expect(expEntry.credit).toBe(200);

    const updatedPo = await PurchaseOrder.findById(po._id);
    expect(updatedPo.dueAmount).toBe(700); // 900 - 200

    global.__debitNoteId = note._id;
  });

  test('voiding the debit note posts a reversing entry, flips status to void, and restores PO dueAmount', async () => {
    const noteId = global.__debitNoteId;
    const voided = await debitNoteService.voidDebitNote(noteId, {
      companyId: company._id, userId: admin._id, reason: 'issued in error',
    });
    expect(voided.status).toBe('void');

    const vouchers = await vouchersFor('DebitNote', noteId);
    expect(vouchers).toHaveLength(2);
    const reversal = vouchers[1];
    const apEntry = reversal.entries.find((e) => String(e.accountId) === String(payableAcc._id));
    const expEntry = reversal.entries.find((e) => String(e.accountId) === String(inventoryAcc._id));
    expect(apEntry.credit).toBe(200);
    expect(expEntry.debit).toBe(200);

    const updatedPo = await PurchaseOrder.findById(po._id);
    expect(updatedPo.dueAmount).toBe(900); // restored
  });

  test('cannot void an already-void debit note', async () => {
    await expect(
      debitNoteService.voidDebitNote(global.__debitNoteId, { companyId: company._id, userId: admin._id })
    ).rejects.toThrow(/already void/);
  });
});
