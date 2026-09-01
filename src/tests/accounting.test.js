/**
 * Integration tests for accountingService.postVoucher — the core
 * "debits must equal credits" invariant every transaction in this app
 * relies on.
 *
 * Note on what's actually enforced: postVoucher() itself does NOT
 * independently validate balance — it just calls periodService and then
 * Voucher.create(). The balance check lives as a schema-level validator
 * on Voucher.entries (see src/models/Voucher.js). So an unbalanced entry
 * is rejected by a Mongoose ValidationError raised during Voucher.create,
 * which postVoucher() propagates unchanged — that's what we assert here,
 * rather than pretending postVoucher has its own bespoke check.
 *
 * Requires a real MongoDB replica set at process.env.MONGO_URI (see
 * jest.config.js header comment). Creates its own throwaway company.
 */
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const connectDB = require('../config/db');

const Account = require('../models/Account');
const Voucher = require('../models/Voucher');
const companyProvisioningService = require('../services/companyProvisioningService');
const accountingService = require('../services/accountingService');

let company;
let cash;
let revenueAcc;

beforeAll(async () => {
  await connectDB();
  const suffix = nanoid(6).toLowerCase();
  const result = await companyProvisioningService.onboardCompany({
    name: `Acct Test Co ${suffix}`,
    industryType: 'retail',
    adminName: 'Acct Test Admin',
    adminEmail: `acct-test-${suffix}@test.local`,
  });
  company = result.company;

  const accounts = await Account.find({ companyId: company._id });
  cash = accounts.find((a) => /^Cash$/.test(a.name));
  revenueAcc = accounts.find((a) => /Sales Revenue/.test(a.name));
});

afterAll(async () => {
  await mongoose.connection.close();
});

describe('accountingService.postVoucher', () => {
  test('produces a balanced entry when debits equal credits', async () => {
    const voucher = await accountingService.postVoucher({
      companyId: company._id,
      type: 'journal',
      narration: 'Balanced test voucher',
      entries: [
        { accountId: cash._id, debit: 500, credit: 0 },
        { accountId: revenueAcc._id, debit: 0, credit: 500 },
      ],
    });

    expect(voucher).toBeTruthy();
    expect(voucher.voucherNumber).toMatch(/^VCH/);

    const totalDebit = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const totalCredit = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    expect(totalDebit).toBe(500);
    expect(totalCredit).toBe(500);
    expect(totalDebit).toBe(totalCredit);

    // Confirm it actually persisted and is independently re-queryable with
    // the same balanced numbers (not just an in-memory return value).
    const reloaded = await Voucher.findById(voucher._id);
    const reloadedDebit = reloaded.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
    const reloadedCredit = reloaded.entries.reduce((sum, e) => sum + (e.credit || 0), 0);
    expect(reloadedDebit).toBe(reloadedCredit);
  });

  test('rejects an unbalanced entry (debits != credits) via the schema validator', async () => {
    await expect(
      accountingService.postVoucher({
        companyId: company._id,
        type: 'journal',
        narration: 'Unbalanced test voucher',
        entries: [
          { accountId: cash._id, debit: 500, credit: 0 },
          { accountId: revenueAcc._id, debit: 0, credit: 300 }, // deliberately short by 200
        ],
      })
    ).rejects.toThrow(/balance/i);

    // And that it genuinely was not persisted.
    const found = await Voucher.findOne({ companyId: company._id, narration: 'Unbalanced test voucher' });
    expect(found).toBeNull();
  });
});
