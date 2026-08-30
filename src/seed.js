/**
 * Minimal seed to get a working sandbox: one company, one branch/warehouse/
 * terminal, an admin user, a couple of accounts, and one sellable product.
 * Run with: npm run seed
 */
require('dotenv').config();
const connectDB = require('./config/db');

const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Warehouse = require('./models/Warehouse');
const PosTerminal = require('./models/PosTerminal');
const User = require('./models/User');
const Account = require('./models/Account');
const ExpenseCategory = require('./models/ExpenseCategory');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Supplier = require('./models/Supplier');
const inventoryService = require('./services/inventoryService');
const categoryService = require('./services/categoryService');

async function seed() {
  await connectDB();

  const company = await Company.create({
    name: 'Demo Retail Store',
    slug: 'demo-retail',
    industryType: 'retail',
    activeModules: [], // set to ['restaurant'] or ['pharmacy'] to try those modules
  });

  // Same default supermarket-style category/subcategory tree
  // companyProvisioningService seeds for every real tenant — the demo
  // company needs it too, or the Products page's required Category field
  // has nothing to select from.
  await categoryService.seedDefaultCategories(company._id);

  const branch = await Branch.create({ companyId: company._id, name: 'Main Branch', code: 'MAIN' });
  const warehouse = await Warehouse.create({ companyId: company._id, branchId: branch._id, name: 'Main Warehouse', isDefault: true });
  const terminal = await PosTerminal.create({ companyId: company._id, branchId: branch._id, name: 'Counter 1' });

  const admin = new User({ companyId: company._id, branchId: branch._id, name: 'Admin', email: 'admin@demo.test' });
  await admin.setPassword('password123');
  await admin.save();

  // A restricted role, to prove permission enforcement actually works —
  // this user can sell at the register but cannot approve expenses or view
  // financial reports (try both with this login vs admin@demo.test, which
  // has no roleId and is treated as super-admin).
  const Role = require('./models/Role');
  const cashierRole = await Role.create({
    companyId: company._id,
    name: 'Cashier',
    permissions: ['pos.sell', 'sales.view', 'reports.view'], // no expenses.*, no reports.financial
  });
  const cashier = new User({
    companyId: company._id, branchId: branch._id, roleId: cashierRole._id,
    name: 'Cashier One', email: 'cashier@demo.test',
  });
  await cashier.setPassword('password123');
  await cashier.save();

  // Chart of accounts — names matter here: several services (purchaseService,
  // reportingService, customer/supplierLedgerService) fall back to a
  // name-based lookup (/receivable/i, /payable/i, /inventory/i, /tax/i) when
  // a specific accountId isn't passed. See README "Next steps" for why a
  // real deployment should let users pick accounts explicitly instead.
  const cashAccount = await Account.create({ companyId: company._id, name: 'Cash', type: 'asset', isPaymentAccount: true });
  await Account.create({ companyId: company._id, name: 'Bank Account', type: 'asset', isPaymentAccount: true });
  await Account.create({ companyId: company._id, name: 'Accounts Receivable', type: 'asset' });
  await Account.create({ companyId: company._id, name: 'Inventory Asset', type: 'asset' });
  await Account.create({ companyId: company._id, name: 'Sales Revenue', type: 'income' });
  await Account.create({ companyId: company._id, name: 'Sales Tax Payable', type: 'liability' });
  await Account.create({ companyId: company._id, name: 'Accounts Payable', type: 'liability' });
  await Account.create({ companyId: company._id, name: 'Cost of Goods Sold', type: 'expense' });
  const rentExpenseAccount = await Account.create({ companyId: company._id, name: 'Rent Expense', type: 'expense' });
  const rentCategory = await ExpenseCategory.create({ companyId: company._id, name: 'Rent', accountId: rentExpenseAccount._id });
  await Account.create({ companyId: company._id, name: 'Salaries Expense', type: 'expense' }); // required by hrService.postPayroll

  const customer = await Customer.create({
    companyId: company._id, name: 'Walk-in Regular — Ahmed', phone: '03001234567', tags: ['VIP'],
  });
  const supplier = await Supplier.create({ companyId: company._id, name: 'City Beverages Distributor', phone: '03007654321' });

  const LoyaltyProgram = require('./models/LoyaltyProgram');
  await LoyaltyProgram.create({ companyId: company._id, earnRate: 100, redemptionValue: 1, minRedeemPoints: 50 });

  const product = await Product.create({
    companyId: company._id,
    name: 'Coca Cola 500ml',
    sku: 'CC-500',
    barcode: '5000112637922',
    trackingMode: 'simple',
    costPrice: 60,
    sellingPrice: 90,
    variants: [{ sku: 'CC-500', barcode: '5000112637922', sellingPrice: 90 }],
  });
  const variant = product.variants[0];

  // Give it opening stock so a test checkout has something to sell.
  await inventoryService.recordMovement({
    companyId: company._id,
    warehouseId: warehouse._id,
    productId: product._id,
    variantId: variant._id,
    type: 'adjustment',
    quantity: 100,
    unitCost: 60, // matches costPrice above — establishes a real avgCost so COGS/margin reporting isn't stuck at 0
    note: 'Opening stock (seed)',
  });

  console.log('Seed complete:');
  console.log({
    companyId: String(company._id),
    warehouseId: String(warehouse._id),
    branchId: String(branch._id),
    posTerminalId: String(terminal._id),
    cashAccountId: String(cashAccount._id),
    rentExpenseCategoryId: String(rentCategory._id),
    customerId: String(customer._id),
    supplierId: String(supplier._id),
    productId: String(product._id),
    variantId: String(variant._id),
    loginEmail: 'admin@demo.test',
    loginPassword: 'password123',
    cashierLoginEmail: 'cashier@demo.test (restricted role — try it against /reports/profit-and-loss for a 403)',
    cashierLoginPassword: 'password123',
  });

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
