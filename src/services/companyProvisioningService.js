/**
 * CompanyProvisioningService — onboards a new tenant. Everything a company
 * needs before it can take its first sale: the Company record, a default
 * branch/warehouse/terminal, a starter chart of accounts (the same names
 * other services fall back to by regex — see README), and one admin user
 * for that company to log into their own (tenant) app with.
 *
 * This is the platform-admin equivalent of what src/seed.js does for the
 * demo company — factored out into a real service so "onboard a company"
 * isn't a script you run once, it's an action platform admins take repeatedly.
 */
const mongoose = require('mongoose');
const Company = require('../models/Company');
const Branch = require('../models/Branch');
const Warehouse = require('../models/Warehouse');
const PosTerminal = require('../models/PosTerminal');
const Account = require('../models/Account');
const User = require('../models/User');
const { nanoid } = require('nanoid');
const categoryService = require('./categoryService');

// `key` maps each starter account to its Company.defaultAccounts slot, so
// onboarding can wire that mapping automatically instead of leaving every
// company to be found later by regex (see defaultAccountsService).
const STARTER_ACCOUNTS = [
  { name: 'Cash', type: 'asset', isPaymentAccount: true },
  { name: 'Bank Account', type: 'asset', isPaymentAccount: true },
  { name: 'Accounts Receivable', type: 'asset', key: 'accountsReceivableId' },
  { name: 'Inventory Asset', type: 'asset', key: 'inventoryAssetId' },
  { name: 'Sales Revenue', type: 'income' },
  { name: 'Sales Tax Payable', type: 'liability', key: 'salesTaxPayableId' },
  { name: 'Accounts Payable', type: 'liability', key: 'accountsPayableId' },
  { name: 'Cost of Goods Sold', type: 'expense', key: 'costOfGoodsSoldId' },
  { name: 'Salaries Expense', type: 'expense', key: 'salariesExpenseId' }, // required by hrService.postPayroll — every onboarded company can run payroll immediately, not just the seeded demo
];

/**
 * @param {Object} input
 * @param {String} input.name - company/business name
 * @param {String} input.industryType
 * @param {String} [input.currency]
 * @param {String} input.adminName - name for the first user
 * @param {String} input.adminEmail
 * @param {String} [input.adminPassword] - generated if omitted
 */
async function onboardCompany(input) {
  const {
    name, industryType = 'retail', currency = 'PKR',
    adminName, adminEmail, adminPassword,
  } = input;

  if (!name) throw new Error('Company name is required.');
  if (!adminEmail) throw new Error('An admin email is required to onboard a company.');

  const existingUser = await User.findOne({ email: adminEmail.toLowerCase() });
  if (existingUser) throw new Error(`A user with email ${adminEmail} already exists.`);

  const session = await mongoose.startSession();
  const generatedPassword = adminPassword || nanoid(12);

  try {
    let result;
    await session.withTransaction(async () => {
      const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${nanoid(5).toLowerCase()}`;

      const [company] = await Company.create(
        [{ name, slug, industryType, currency, activeModules: [] }],
        { session }
      );

      const [branch] = await Branch.create(
        [{ companyId: company._id, name: 'Main Branch', code: 'MAIN' }],
        { session }
      );

      const [warehouse] = await Warehouse.create(
        [{ companyId: company._id, branchId: branch._id, name: 'Main Warehouse', isDefault: true }],
        { session }
      );

      const [terminal] = await PosTerminal.create(
        [{ companyId: company._id, branchId: branch._id, name: 'Counter 1' }],
        { session }
      );

      // ordered: true is required — this Mongoose version refuses a
      // multi-document create() inside a session unless ordering is stated
      // explicitly. Ordered is correct here: defaultAccounts below is built
      // by positional index into this same array, which only stays valid
      // if documents are created in the order given.
      const createdAccounts = await Account.create(
        STARTER_ACCOUNTS.map(({ key, ...a }) => ({ ...a, companyId: company._id })),
        { session, ordered: true }
      );

      // Wire the explicit defaultAccounts mapping from what was just
      // created — this is what lets every posting elsewhere in the app
      // (COGS, payroll, receivable/payable) resolve without guessing by name.
      const defaultAccounts = {};
      STARTER_ACCOUNTS.forEach((starter, i) => {
        if (starter.key) defaultAccounts[starter.key] = createdAccounts[i]._id;
      });
      company.defaultAccounts = defaultAccounts;
      await company.save({ session });

      const admin = new User({ companyId: company._id, branchId: branch._id, name: adminName || 'Admin', email: adminEmail.toLowerCase() });
      await admin.setPassword(generatedPassword);
      await admin.save({ session });

      result = { company, branch, warehouse, posTerminal: terminal, admin, generatedPassword };
    });

    // Outside the transaction, same as the reasoning elsewhere in this app for
    // best-effort side effects: seeding the default category tree is not part
    // of what makes a company "provisioned" — a failure here shouldn't roll
    // back the company/branch/accounts/admin that just succeeded.
    try {
      await categoryService.seedDefaultCategories(result.company._id, result.company.industryType);
    } catch (err) {
      console.error(`Default category seeding failed for company ${result.company._id} (onboarding still succeeded):`, err.message);
    }

    return result;
  } finally {
    session.endSession();
  }
}

module.exports = { onboardCompany, STARTER_ACCOUNTS };
