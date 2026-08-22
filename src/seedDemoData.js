/**
 * seedDemoData.js — enriches the ONE existing main demo company
 * (admin@demo.test, created by src/seed.js) with realistic data across
 * every module, so the app doesn't look like an empty shell when testing.
 *
 * This is DIFFERENT from seedIndustryDemos.js (which creates separate
 * per-industry demo companies) — this script finds the existing main demo
 * company and adds to it. Copies that script's resilience style: a ctx
 * object, try/catch per section so one failure never kills the rest, and
 * "skip if already exists" idempotency so it's safe to re-run.
 *
 * Run with: node src/seedDemoData.js  (requires MONGO_URI in .env)
 *
 * All service call shapes below are copied directly from working patterns
 * in src/smokeTest.js and src/seedIndustryDemos.js — see those files for
 * the original traces behind each shape used here.
 */
require('dotenv').config();
const connectDB = require('./config/db');

const Company = require('./models/Company');
const Branch = require('./models/Branch');
const Warehouse = require('./models/Warehouse');
const Account = require('./models/Account');
const ExpenseCategory = require('./models/ExpenseCategory');
const Product = require('./models/Product');
const ProductBatch = require('./models/ProductBatch');
const Customer = require('./models/Customer');
const Supplier = require('./models/Supplier');
const User = require('./models/User');
const Sale = require('./models/Sale');
const Lead = require('./models/Lead');

const inventoryService = require('./services/inventoryService');
const posSaleService = require('./services/posSaleService');
const purchaseService = require('./services/purchaseService');
const requisitionService = require('./services/requisitionService');
const expenseService = require('./services/expenseService');
const hrService = require('./services/hrService');
const projectService = require('./services/projectService');
const crmPipelineService = require('./services/crmPipelineService');
const budgetService = require('./services/budgetService');
const costCenterService = require('./services/costCenterService');
const recurringInvoiceService = require('./services/recurringInvoiceService');
const appointmentService = require('./services/appointmentService');
const ticketService = require('./services/ticketService');
const employeeLoanService = require('./services/employeeLoanService');
const fixedAssetService = require('./services/fixedAssetService');
const rfqService = require('./services/rfqService');
const accountingService = require('./services/accountingService');

const summary = [];
function ok(section, msg) { summary.push(`✓ ${section}: ${msg}`); console.log(`✓ ${section}: ${msg}`); }
function skip(section, msg) { summary.push(`- ${section}: ${msg}`); console.log(`- ${section}: ${msg}`); }
function fail(section, err) { summary.push(`✗ ${section}: FAILED — ${err.message}`); console.warn(`✗ ${section}: FAILED — ${err.message}`); }

function randomPast(daysBack) {
  const ms = Date.now() - Math.random() * daysBack * 24 * 60 * 60 * 1000;
  return new Date(ms);
}
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

async function main() {
  await connectDB();

  const admin = await User.findOne({ email: 'admin@demo.test' });
  if (!admin) {
    console.error('No user found with email admin@demo.test. Run `npm run seed` first to create the main demo company, then re-run this script.');
    process.exit(1);
  }

  const company = await Company.findById(admin.companyId);
  const branch = await Branch.findOne({ companyId: company._id });
  const warehouse = await Warehouse.findOne({ companyId: company._id });
  const accounts = await Account.find({ companyId: company._id });
  const cash = accounts.find((a) => /^Cash$/i.test(a.name)) || accounts.find((a) => /Cash/i.test(a.name));
  const bank = accounts.find((a) => /Bank/i.test(a.name));
  const salariesAcc = accounts.find((a) => /Salar/i.test(a.name));
  const existingCustomer = await Customer.findOne({ companyId: company._id });
  const existingSupplier = await Supplier.findOne({ companyId: company._id });
  const existingProduct = await Product.findOne({ companyId: company._id });

  if (!cash || !warehouse || !branch) {
    console.error('Main demo company is missing Branch/Warehouse/Cash account. Run `npm run seed` first.');
    process.exit(1);
  }

  const ctx = { company, branch, warehouse, admin, cash, bank, salariesAcc, accounts };

  console.log(`Enriching company "${company.name}" (${company._id}) for admin@demo.test ...\n`);

  // ---------------------------------------------------------------------
  // 1. Products
  // ---------------------------------------------------------------------
  let products = [];
  try {
    const catalog = [
      // [name, sku, cost, sell, stock, reorderLevel]
      ['Pepsi 500ml', 'PEP-500', 55, 85, 120, 20],
      ['7Up 500ml', '7UP-500', 55, 85, 100, 20],
      ['Mineral Water 1.5L', 'WATER-1.5L', 30, 50, 200, 30],
      ['Red Bull Energy Drink', 'RB-250', 150, 220, 60, 15],
      ['Orange Juice 1L', 'OJ-1L', 90, 140, 40, 10],
      ['Lays Classic Chips', 'LAYS-CLS', 40, 70, 80, 15],
      ['Doritos Nacho', 'DOR-NCH', 60, 100, 50, 10],
      ['Kit Kat 4-Finger', 'KK-4F', 35, 60, 90, 20],
      ['Oreo Cookies', 'OREO-STD', 45, 80, 70, 15],
      ['Pringles Original', 'PRING-ORG', 120, 180, 8, 15], // low stock
      ['Dish Soap 500ml', 'DISH-500', 70, 120, 50, 10],
      ['Laundry Detergent 1kg', 'LAUN-1KG', 180, 280, 5, 12], // low stock
      ['Tissue Paper Box', 'TISS-BOX', 40, 70, 100, 20],
      ['Air Freshener Spray', 'AIRFR-SPR', 90, 150, 30, 10],
      ['Toothpaste 100g', 'TOOTH-100', 60, 100, 60, 15],
      ['Shampoo 400ml', 'SHMP-400', 150, 240, 45, 10],
      ['Bar Soap 3-Pack', 'SOAP-3PK', 55, 90, 3, 10], // low stock
      ['Hand Sanitizer 100ml', 'SANIT-100', 40, 70, 75, 15],
      ['Instant Noodles Pack', 'NOOD-PK', 25, 45, 150, 25],
      ['Biscuits Family Pack', 'BISC-FAM', 65, 110, 55, 12],
    ];

    for (const [name, sku, costPrice, sellingPrice, qty, reorderLevel] of catalog) {
      let p = await Product.findOne({ companyId: company._id, sku });
      if (p) { skip('Products', `${sku} already exists`); products.push(p); continue; }
      p = await Product.create({
        companyId: company._id, name, sku, trackingMode: 'simple',
        costPrice, sellingPrice, reorderLevel,
        variants: [{ sku, sellingPrice }],
      });
      await inventoryService.recordMovement({
        companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
        type: 'adjustment', quantity: qty, note: 'Demo data seed opening stock',
      });
      products.push(p);
    }

    // One near-expiry batch item, if Product supports batch tracking cleanly.
    let batchProduct = await Product.findOne({ companyId: company._id, sku: 'YOG-BATCH' });
    if (!batchProduct) {
      batchProduct = await Product.create({
        companyId: company._id, name: 'Fresh Yogurt Cup', sku: 'YOG-BATCH', trackingMode: 'batch',
        costPrice: 35, sellingPrice: 60, reorderLevel: 10,
        variants: [{ sku: 'YOG-BATCH', sellingPrice: 60 }],
      });
      const batch = await ProductBatch.create({
        companyId: company._id, productId: batchProduct._id, variantId: batchProduct.variants[0]._id,
        batchNumber: 'YOG-2026-08', manufactureDate: new Date(Date.now() - 25 * 86400000),
        expiryDate: new Date(Date.now() + 4 * 86400000), // near-expiry
      });
      await inventoryService.recordMovement({
        companyId: company._id, warehouseId: warehouse._id, productId: batchProduct._id, variantId: batchProduct.variants[0]._id,
        batchId: batch._id, type: 'adjustment', quantity: 40, note: 'Demo data seed opening stock (near-expiry batch)',
      });
      products.push(batchProduct);
      ok('Products', `created ${catalog.length} products + 1 near-expiry batch product (Fresh Yogurt Cup)`);
    } else {
      skip('Products', 'near-expiry batch product already exists');
      products.push(batchProduct);
    }
  } catch (err) { fail('Products', err); }

  // ---------------------------------------------------------------------
  // 2. Customers
  // ---------------------------------------------------------------------
  let customers = [existingCustomer].filter(Boolean);
  try {
    const roster = [
      ['Fatima Retail Store', '03211234567', ['Wholesale']],
      ['Bilal Traders', '03221234567', ['Wholesale', 'VIP']],
      ['Sana Khan', '03019876543', ['VIP']],
      ['Hamza General Store', '03331234567', []],
      ['Ayesha Malik', '03451234567', []],
      ['Usman Grocers', '03001112223', ['Wholesale']],
      ['Zara Convenience Mart', '03214445556', []],
      ['Imran Yousaf', '03337778889', ['VIP']],
    ];
    let created = 0;
    for (const [name, phone, tags] of roster) {
      let c = await Customer.findOne({ companyId: company._id, name });
      if (c) { customers.push(c); continue; }
      c = await Customer.create({ companyId: company._id, name, phone, tags });
      customers.push(c);
      created++;
    }
    ok('Customers', `created ${created} new customers (skipped ${roster.length - created} existing)`);
  } catch (err) { fail('Customers', err); }

  // ---------------------------------------------------------------------
  // 3. Suppliers
  // ---------------------------------------------------------------------
  let suppliers = [existingSupplier].filter(Boolean);
  try {
    const roster = [
      ['National Foods Distributor', '02134567890'],
      ['Premier Household Supplies', '02134567891'],
      ['Karachi Wholesale Mart', '02134567892'],
      ['Metro Beverages Co.', '02134567893'],
    ];
    let created = 0;
    for (const [name, phone] of roster) {
      let s = await Supplier.findOne({ companyId: company._id, name });
      if (s) { suppliers.push(s); continue; }
      s = await Supplier.create({ companyId: company._id, name, phone });
      suppliers.push(s);
      created++;
    }
    ok('Suppliers', `created ${created} new suppliers (skipped ${roster.length - created} existing)`);
  } catch (err) { fail('Suppliers', err); }

  // ---------------------------------------------------------------------
  // 4. Sales history (25-40 POS sales over the last 30 days, backdated)
  // ---------------------------------------------------------------------
  try {
    const sellableProducts = products.filter((p) => p && p.trackingMode !== 'batch');
    const existingDemoSales = await Sale.countDocuments({ companyId: company._id, saleType: 'pos' });
    if (existingDemoSales >= 25) {
      skip('Sales history', `${existingDemoSales} POS sales already exist, skipping bulk seed`);
    } else if (sellableProducts.length === 0) {
      skip('Sales history', 'no sellable products available');
    } else {
      const targetCount = randInt(25, 40);
      let created = 0;
      for (let i = 0; i < targetCount; i++) {
        try {
          const lineCount = randInt(1, 4);
          const items = [];
          for (let j = 0; j < lineCount; j++) {
            const prod = pick(sellableProducts);
            const variant = prod.variants[0];
            items.push({
              productId: prod._id, variantId: variant._id,
              quantity: randInt(1, 5), unitPrice: variant.sellingPrice || prod.sellingPrice,
            });
          }
          const totalAmount = items.reduce((s, it) => s + it.quantity * it.unitPrice, 0);
          const isPartial = Math.random() < 0.15; // ~15% partial payment -> AR aging data
          const paidAmount = isPartial ? Math.round(totalAmount * 0.5) : totalAmount;
          const method = Math.random() < 0.6 ? 'cash' : 'card';
          const customer = Math.random() < 0.7 ? pick(customers) : null;

          const sale = await posSaleService.checkout({
            userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
            customerId: customer ? customer._id : undefined,
            items,
            payments: [{ paymentAccountId: cash._id, method, amount: paidAmount }],
          });

          // Backdate spread across the last 30 days — checkout() always
          // stamps "now"; Sale has { timestamps: true } (see models/Sale.js
          // line 100), so an explicit findByIdAndUpdate on createdAt is the
          // clean way to backdate after the fact without fighting the
          // transactional checkout path itself.
          const backdate = randomPast(30);
          await Sale.findByIdAndUpdate(sale._id, { createdAt: backdate, updatedAt: backdate });
          created++;
        } catch (innerErr) {
          console.warn(`  (sale #${i + 1} skipped: ${innerErr.message})`);
        }
      }
      ok('Sales history', `created ${created} backdated POS sales across the last 30 days`);
    }
  } catch (err) { fail('Sales history', err); }

  // ---------------------------------------------------------------------
  // 5. Purchase orders (draft / approved-not-received / received / partial)
  // ---------------------------------------------------------------------
  try {
    const supplier = suppliers[0] || existingSupplier;
    const poProducts = products.filter((p) => p && p.trackingMode === 'simple').slice(0, 8);
    const PurchaseOrder = require('./models/PurchaseOrder');
    const alreadySeededPOs = await PurchaseOrder.countDocuments({ companyId: company._id, branchId: branch._id });
    if (alreadySeededPOs >= 4 || poProducts.length === 0) {
      skip('Purchase orders', `${alreadySeededPOs} purchase orders already exist`);
    } else {
      let count = 0;

      // 1. Draft (not approved)
      await purchaseService.createPurchaseOrder({
        companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
        items: [{ productId: poProducts[0]._id, variantId: poProducts[0].variants[0]._id, quantityOrdered: 50, unitCost: poProducts[0].costPrice }],
        userId: admin._id,
      });
      count++;

      // 2. Approved but not received
      const po2 = await purchaseService.createPurchaseOrder({
        companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
        items: [{ productId: poProducts[1]._id, variantId: poProducts[1].variants[0]._id, quantityOrdered: 30, unitCost: poProducts[1].costPrice }],
        userId: admin._id,
      });
      await purchaseService.decidePurchaseOrder(po2._id, { approve: true, userId: admin._id });
      count++;

      // 3. Fully received
      const po3 = await purchaseService.createPurchaseOrder({
        companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
        items: [{ productId: poProducts[2]._id, variantId: poProducts[2].variants[0]._id, quantityOrdered: 40, unitCost: poProducts[2].costPrice }],
        userId: admin._id,
      });
      const approved3 = await purchaseService.decidePurchaseOrder(po3._id, { approve: true, userId: admin._id });
      await purchaseService.receiveGoods({
        purchaseOrderId: approved3._id, warehouseId: warehouse._id,
        items: [{ purchaseOrderItemId: approved3.items[0]._id, productId: poProducts[2]._id, variantId: poProducts[2].variants[0]._id, quantity: 40, unitCost: poProducts[2].costPrice }],
        userId: admin._id,
      });
      count++;

      // 4. Partially received
      const po4 = await purchaseService.createPurchaseOrder({
        companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
        items: [{ productId: poProducts[3]._id, variantId: poProducts[3].variants[0]._id, quantityOrdered: 60, unitCost: poProducts[3].costPrice }],
        userId: admin._id,
      });
      const approved4 = await purchaseService.decidePurchaseOrder(po4._id, { approve: true, userId: admin._id });
      await purchaseService.receiveGoods({
        purchaseOrderId: approved4._id, warehouseId: warehouse._id,
        items: [{ purchaseOrderItemId: approved4.items[0]._id, productId: poProducts[3]._id, variantId: poProducts[3].variants[0]._id, quantity: 25, unitCost: poProducts[3].costPrice }],
        userId: admin._id,
      });
      count++;

      // 5. Requisition -> PO -> approve (exercises the requisition workflow)
      if (poProducts[4]) {
        const req = await requisitionService.create({
          companyId: company._id, branchId: branch._id,
          items: [{ productId: poProducts[4]._id, variantId: poProducts[4].variants[0]._id, quantityRequested: 20 }],
          requestedBy: admin._id,
        });
        const decidedReq = await requisitionService.decide(req._id, { approve: true, userId: admin._id });
        const po5 = await purchaseService.createPurchaseOrder({
          companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
          requisitionId: decidedReq._id,
          items: [{ productId: poProducts[4]._id, variantId: poProducts[4].variants[0]._id, quantityOrdered: 20, unitCost: poProducts[4].costPrice }],
          userId: admin._id,
        });
        await purchaseService.decidePurchaseOrder(po5._id, { approve: true, userId: admin._id });
        count++;
      }

      ok('Purchase orders', `created ${count} purchase orders (draft / approved / fully received / partially received / from requisition)`);
    }
  } catch (err) { fail('Purchase orders', err); }

  // ---------------------------------------------------------------------
  // 6. Expenses
  // ---------------------------------------------------------------------
  try {
    const Expense = require('./models/Expense');
    const existingExpenses = await Expense.countDocuments({ companyId: company._id });
    if (existingExpenses >= 8) {
      skip('Expenses', `${existingExpenses} expenses already exist`);
    } else {
      const categoriesSpec = [
        ['Rent', 45000], ['Utilities', 12000], ['Marketing', 8000], ['Fuel', 6000],
        ['Office Supplies', 3000], ['Maintenance', 5000], ['Internet & Phone', 4000],
        ['Miscellaneous', 2500], ['Marketing', 9000], ['Fuel', 3500],
      ];
      let created = 0;
      for (let i = 0; i < categoriesSpec.length; i++) {
        const [catName, amount] = categoriesSpec[i];
        let category = await ExpenseCategory.findOne({ companyId: company._id, name: catName });
        if (!category) {
          category = await ExpenseCategory.create({ companyId: company._id, name: catName, accountId: (salariesAcc || accounts[0])._id });
        }
        const expense = await expenseService.submitExpense({
          companyId: company._id, categoryId: category._id, paymentAccountId: cash._id,
          amount, userId: admin._id,
        });
        // Leave the last one pending approval so an approval-queue screen has data.
        if (i < categoriesSpec.length - 1) {
          await expenseService.approveExpense(expense._id, admin._id);
        }
        created++;
      }
      ok('Expenses', `created ${created} expenses across categories, 1 left pending approval`);
    }
  } catch (err) { fail('Expenses', err); }

  // ---------------------------------------------------------------------
  // 7. Employees + payroll
  // ---------------------------------------------------------------------
  let employees = [];
  try {
    const Employee = require('./models/Employee');
    const existingEmployees = await Employee.find({ companyId: company._id });
    if (existingEmployees.length >= 4) {
      employees = existingEmployees;
      skip('Employees', `${existingEmployees.length} employees already exist`);
    } else {
      const roster = [
        ['Ahmed Raza', 'Store Manager', { basic: 60000, allowances: 5000, deductions: 0 }],
        ['Sadia Iqbal', 'Cashier', { basic: 30000, allowances: 2000, deductions: 0 }],
        ['Bilal Ahmed', 'Warehouse Staff', { basic: 28000, allowances: 1500, deductions: 0 }],
        ['Nadia Sheikh', 'Sales Associate', { basic: 32000, allowances: 2000, deductions: 0 }],
        ['Kamran Ali', 'Delivery Rider', { basic: 25000, allowances: 3000, deductions: 0 }],
      ];
      for (const [name, designation, salaryStructure] of roster) {
        const emp = await hrService.createEmployee({ companyId: company._id, branchId: branch._id, name, designation, salaryStructure });
        employees.push(emp);
      }
      ok('Employees', `created ${employees.length} employees`);
    }

    // Run one payroll cycle for the current month, if not already run.
    const PayrollRun = require('./models/PayrollRun');
    const now = new Date();
    const existingRun = await PayrollRun.findOne({ companyId: company._id, month: now.getMonth() + 1, year: now.getFullYear() });
    if (existingRun) {
      skip('Payroll', `payroll for ${now.getMonth() + 1}/${now.getFullYear()} already run (status: ${existingRun.status})`);
    } else {
      const run = await hrService.generatePayroll({ companyId: company._id, month: now.getMonth() + 1, year: now.getFullYear(), userId: admin._id });
      await hrService.postPayroll(run._id, { paymentAccountId: cash._id, userId: admin._id });
      ok('Payroll', `ran + posted payroll for ${now.getMonth() + 1}/${now.getFullYear()}`);
    }
  } catch (err) { fail('Employees + Payroll', err); }

  // ---------------------------------------------------------------------
  // 8. Projects
  // ---------------------------------------------------------------------
  let projects = [];
  try {
    const Project = require('./models/Project');
    const existingProjects = await Project.find({ companyId: company._id });
    if (existingProjects.length >= 2) {
      projects = existingProjects;
      skip('Projects', `${existingProjects.length} projects already exist`);
    } else {
      const specs = [
        ['Store Renovation', 200000],
        ['New Branch Setup', 500000],
        ['POS Hardware Upgrade', 80000],
      ];
      for (const [name, budget] of specs) {
        const proj = await projectService.createProject({ companyId: company._id, name, budget, customerId: customers[0] ? customers[0]._id : undefined });
        projects.push(proj);
      }
      // Tag an expense + a project-linked sale to the first project so P&L shows something.
      const project = projects[0];
      let projCategory = await ExpenseCategory.findOne({ companyId: company._id, name: 'Project Materials' });
      if (!projCategory) {
        projCategory = await ExpenseCategory.create({ companyId: company._id, name: 'Project Materials', accountId: (salariesAcc || accounts[0])._id });
      }
      const projExpense = await expenseService.submitExpense({
        companyId: company._id, categoryId: projCategory._id, paymentAccountId: cash._id,
        amount: 15000, projectId: project._id, userId: admin._id,
      });
      await expenseService.approveExpense(projExpense._id, admin._id);

      if (products[0]) {
        await posSaleService.checkout({
          userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
          customerId: customers[0] ? customers[0]._id : undefined, projectId: project._id,
          items: [{ productId: products[0]._id, variantId: products[0].variants[0]._id, quantity: 2, unitPrice: products[0].variants[0].sellingPrice || products[0].sellingPrice }],
          payments: [{ paymentAccountId: cash._id, method: 'cash', amount: (products[0].variants[0].sellingPrice || products[0].sellingPrice) * 2 }],
        });
      }
      ok('Projects', `created ${projects.length} projects, tagged an expense + a sale to "${project.name}" for P&L`);
    }
  } catch (err) { fail('Projects', err); }

  // ---------------------------------------------------------------------
  // 9. CRM: Leads + Pipeline
  // ---------------------------------------------------------------------
  try {
    const existingLeads = await Lead.countDocuments({ companyId: company._id });
    if (existingLeads >= 6) {
      skip('CRM leads', `${existingLeads} leads already exist`);
    } else {
      const leadSpecs = [
        ['Al-Karim Superstore', 'new'], ['Green Valley Mart', 'contacted'], ['City Center Retailers', 'qualified'],
        ['Sunrise Grocers', 'new'], ['Blue Ocean Traders', 'contacted'], ['Metro Wholesale Hub', 'qualified'],
        ['Rapid Mart Chain', 'new'], ['Silver Star Distributors', 'contacted'],
      ];
      const leads = [];
      for (const [name, status] of leadSpecs) {
        const lead = await crmPipelineService.createLead({
          companyId: company._id, name, contactName: name.split(' ')[0] + ' Manager',
          phone: `030${randInt(10000000, 99999999)}`, source: pick(['referral', 'website', 'walk-in', 'other']),
        });
        if (status !== 'new') await crmPipelineService.updateLeadStatus(lead._id, status);
        leads.push(lead);
      }
      ok('CRM leads', `created ${leads.length} leads across new/contacted/qualified`);

      // Opportunities across pipeline stages.
      const stageSpecs = ['new', 'contacted', 'proposal', 'negotiation'];
      const opportunities = [];
      for (let i = 0; i < 6; i++) {
        const lead = leads[i % leads.length];
        const opp = await crmPipelineService.createOpportunity({
          companyId: company._id, leadId: lead._id, title: `${lead.name} — Bulk Supply Deal`,
          estimatedValue: randInt(20000, 300000), stage: 'new',
        });
        const targetStage = stageSpecs[i % stageSpecs.length];
        if (targetStage !== 'new') {
          await crmPipelineService.updateOpportunityStage(opp._id, targetStage);
        }
        opportunities.push(opp);
      }

      // Win one opportunity (requires branchId/warehouseId/items/userId).
      if (products[0]) {
        const winLead = leads[leads.length - 1];
        const winOpp = await crmPipelineService.createOpportunity({
          companyId: company._id, leadId: winLead._id, title: `${winLead.name} — Won Deal`, estimatedValue: 150000, stage: 'new',
        });
        await crmPipelineService.updateOpportunityStage(winOpp._id, 'won', {
          branchId: branch._id, warehouseId: warehouse._id, userId: admin._id,
          items: [{ productId: products[0]._id, variantId: products[0].variants[0]._id, quantity: 50, unitPrice: products[0].variants[0].sellingPrice || products[0].sellingPrice }],
        });
      }

      // Lose one opportunity.
      const loseLead = leads[0];
      const loseOpp = await crmPipelineService.createOpportunity({
        companyId: company._id, leadId: loseLead._id, title: `${loseLead.name} — Lost Deal`, estimatedValue: 60000, stage: 'new',
      });
      await crmPipelineService.updateOpportunityStage(loseOpp._id, 'lost', { lostReason: 'Chose a competitor on price.' });

      // Convert 1-2 leads directly to customers.
      await crmPipelineService.convertLeadToCustomer(leads[1]._id);
      await crmPipelineService.convertLeadToCustomer(leads[2]._id);

      ok('CRM pipeline', `created 8 opportunities spanning new/contacted/proposal/negotiation/won/lost, converted 2 leads to customers`);
    }
  } catch (err) { fail('CRM', err); }

  // ---------------------------------------------------------------------
  // 10. Budgets + Cost centers
  // ---------------------------------------------------------------------
  try {
    const now = new Date();
    const budgetAccount = (accounts.find((a) => /Rent Expense/i.test(a.name))) || accounts.find((a) => a.type === 'expense');
    if (budgetAccount) {
      await budgetService.setBudget({ companyId: company._id, accountId: budgetAccount._id, month: now.getMonth() + 1, year: now.getFullYear(), budgetedAmount: 60000 });
      ok('Budgets', `set a budget for ${now.getMonth() + 1}/${now.getFullYear()} on "${budgetAccount.name}"`);
    } else {
      skip('Budgets', 'no expense account available to budget against');
    }

    const CostCenter = require('./models/CostCenter');
    const existingCC = await CostCenter.countDocuments({ companyId: company._id });
    if (existingCC >= 2) {
      skip('Cost centers', `${existingCC} cost centers already exist`);
    } else {
      await costCenterService.createCostCenter({ companyId: company._id, name: 'Sales Floor', code: 'CC-SALES' });
      await costCenterService.createCostCenter({ companyId: company._id, name: 'Warehouse Ops', code: 'CC-WH' });
      ok('Cost centers', 'created 2 cost centers (Sales Floor, Warehouse Ops)');
    }
  } catch (err) { fail('Budgets + Cost centers', err); }

  // ---------------------------------------------------------------------
  // 11. Recurring invoices
  // ---------------------------------------------------------------------
  try {
    const RecurringInvoiceTemplate = require('./models/RecurringInvoiceTemplate');
    const existing = await RecurringInvoiceTemplate.countDocuments({ companyId: company._id });
    if (existing >= 1) {
      skip('Recurring invoices', `${existing} template(s) already exist`);
    } else if (products[0] && customers[0]) {
      await recurringInvoiceService.createTemplate({
        companyId: company._id, branchId: branch._id, customerId: customers[0]._id,
        items: [{ productId: products[0]._id, variantId: products[0].variants[0]._id, quantity: 10, unitPrice: products[0].variants[0].sellingPrice || products[0].sellingPrice }],
        frequency: 'monthly', startDate: new Date(),
      });
      if (products[1] && customers[1]) {
        await recurringInvoiceService.createTemplate({
          companyId: company._id, branchId: branch._id, customerId: customers[1]._id,
          items: [{ productId: products[1]._id, variantId: products[1].variants[0]._id, quantity: 5, unitPrice: products[1].variants[0].sellingPrice || products[1].sellingPrice }],
          frequency: 'monthly', startDate: new Date(),
        });
      }
      ok('Recurring invoices', 'created 2 recurring monthly invoice templates');
    } else {
      skip('Recurring invoices', 'no products/customers available yet');
    }
  } catch (err) { fail('Recurring invoices', err); }

  // ---------------------------------------------------------------------
  // 12. Appointments
  // ---------------------------------------------------------------------
  try {
    const Appointment = require('./models/Appointment');
    const existing = await Appointment.countDocuments({ companyId: company._id });
    if (existing >= 3) {
      skip('Appointments', `${existing} appointments already exist`);
    } else {
      const specs = [
        { offsetHours: -72, durationHours: 1, status: 'completed', label: 'Consultation follow-up' },
        { offsetHours: -24, durationHours: 1, status: 'completed', label: 'Product demo' },
        { offsetHours: 24, durationHours: 1, status: 'scheduled', label: 'Bulk order discussion' },
        { offsetHours: 72, durationHours: 2, status: 'confirmed', label: 'Store walkthrough' },
      ];
      let created = 0;
      for (const spec of specs) {
        const start = new Date(Date.now() + spec.offsetHours * 3600000);
        const end = new Date(start.getTime() + spec.durationHours * 3600000);
        const appt = await appointmentService.book({
          companyId: company._id, branchId: branch._id, customerId: customers[created % customers.length] ? customers[created % customers.length]._id : undefined,
          staffUserId: admin._id, serviceName: spec.label, startTime: start, endTime: end, userId: admin._id,
        });
        if (spec.status !== 'scheduled') {
          await appointmentService.updateStatus(appt._id, spec.status);
        }
        created++;
      }
      ok('Appointments', `created ${created} appointments (mix of completed/scheduled/confirmed)`);
    }
  } catch (err) { fail('Appointments', err); }

  // ---------------------------------------------------------------------
  // 13. Helpdesk tickets
  // ---------------------------------------------------------------------
  try {
    const Ticket = require('./models/Ticket');
    const existing = await Ticket.countDocuments({ companyId: company._id });
    if (existing >= 3) {
      skip('Tickets', `${existing} tickets already exist`);
    } else {
      const specs = [
        { category: 'billing', subject: 'Invoice discrepancy', description: 'Customer says the invoice total looks wrong.', priority: 'high', resolve: true },
        { category: 'technical', subject: 'POS terminal freezing', description: 'Counter 1 terminal freezes intermittently.', priority: 'emergency', resolve: false },
        { category: 'general', subject: 'Wholesale pricing question', description: 'A customer is asking about bulk pricing tiers.', priority: 'low', resolve: false },
        { category: 'technical', subject: 'Barcode scanner not working', description: 'Scanner at Counter 1 stopped reading barcodes.', priority: 'medium', resolve: 'close' },
      ];
      let created = 0;
      for (const spec of specs) {
        const ticket = await ticketService.createTicket({
          companyId: company._id, branchId: branch._id, customerId: customers[0] ? customers[0]._id : undefined,
          category: spec.category, subject: spec.subject, description: spec.description, priority: spec.priority,
        });
        await ticketService.assignTicket(ticket._id, { assignedToUserId: admin._id });
        if (spec.resolve === true || spec.resolve === 'close') {
          const resolved = await ticketService.resolveTicket(ticket._id, { resolutionNote: 'Resolved by demo seed.' });
          if (spec.resolve === 'close') await ticketService.closeTicket(resolved._id);
        }
        created++;
      }
      ok('Tickets', `created ${created} tickets across statuses/priorities`);
    }
  } catch (err) { fail('Tickets', err); }

  // ---------------------------------------------------------------------
  // 14. Employee loan
  // ---------------------------------------------------------------------
  try {
    const EmployeeLoan = require('./models/EmployeeLoan');
    const existing = await EmployeeLoan.countDocuments({ companyId: company._id });
    if (existing >= 1) {
      skip('Employee loan', `${existing} loan(s) already exist`);
    } else if (employees[0]) {
      let loanReceivable = accounts.find((a) => /Loan/i.test(a.name));
      if (!loanReceivable) {
        loanReceivable = await Account.create({ companyId: company._id, name: 'Employee Loans Receivable', type: 'asset' });
      }
      await employeeLoanService.disburseLoan({
        companyId: company._id, branchId: branch._id, employeeId: employees[0]._id,
        principalAmount: 20000, monthlyInstallment: 4000,
        loanReceivableAccountId: loanReceivable._id, disbursingAccountId: cash._id, userId: admin._id,
      });
      ok('Employee loan', `disbursed a 20000 loan to ${employees[0].name}`);
    } else {
      skip('Employee loan', 'no employees available');
    }
  } catch (err) { fail('Employee loan', err); }

  // ---------------------------------------------------------------------
  // 15. Fixed assets (with depreciation)
  // ---------------------------------------------------------------------
  try {
    const FixedAsset = require('./models/FixedAsset');
    const existing = await FixedAsset.countDocuments({ companyId: company._id });
    if (existing >= 1) {
      skip('Fixed assets', `${existing} asset(s) already exist`);
    } else {
      let assetAcc = accounts.find((a) => /Fixed Asset|Equipment \(Asset\)/i.test(a.name));
      if (!assetAcc) assetAcc = await Account.create({ companyId: company._id, name: 'Store Equipment (Asset)', type: 'asset' });
      let depExpense = accounts.find((a) => /Depreciation Expense/i.test(a.name));
      if (!depExpense) depExpense = await Account.create({ companyId: company._id, name: 'Depreciation Expense', type: 'expense' });
      let accumDep = accounts.find((a) => /Accumulated Depreciation/i.test(a.name));
      if (!accumDep) accumDep = await Account.create({ companyId: company._id, name: 'Accumulated Depreciation', type: 'asset' });

      const vehicle = await fixedAssetService.registerAsset({
        companyId: company._id, branchId: branch._id, name: 'Delivery Van', category: 'Vehicle',
        assetAccountId: assetAcc._id, depreciationExpenseAccountId: depExpense._id, accumulatedDepreciationAccountId: accumDep._id,
        purchaseDate: new Date(Date.now() - 60 * 86400000), purchaseCost: 1500000, salvageValue: 150000, usefulLifeMonths: 60,
      });
      const now = new Date();
      const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      await fixedAssetService.runDepreciation(vehicle._id, { period, userId: admin._id });

      const equipment = await fixedAssetService.registerAsset({
        companyId: company._id, branchId: branch._id, name: 'POS Terminal Hardware', category: 'Equipment',
        assetAccountId: assetAcc._id, depreciationExpenseAccountId: depExpense._id, accumulatedDepreciationAccountId: accumDep._id,
        purchaseDate: new Date(Date.now() - 30 * 86400000), purchaseCost: 80000, salvageValue: 5000, usefulLifeMonths: 36,
      });

      ok('Fixed assets', `registered Delivery Van (with 1 depreciation period run) + POS Terminal Hardware`);
      void equipment;
    }
  } catch (err) { fail('Fixed assets', err); }

  // ---------------------------------------------------------------------
  // 16. RFQ
  // ---------------------------------------------------------------------
  try {
    const RFQ = require('./models/RFQ');
    const existing = await RFQ.countDocuments({ companyId: company._id });
    if (existing >= 1) {
      skip('RFQ', `${existing} RFQ(s) already exist`);
    } else if (products.length >= 2 && suppliers.length >= 2) {
      const rfq = await rfqService.createRFQ({
        companyId: company._id, branchId: branch._id,
        items: [
          { productId: products[0]._id, variantId: products[0].variants[0]._id, quantity: 100 },
          { productId: products[1]._id, variantId: products[1].variants[0]._id, quantity: 50 },
        ],
      });
      await rfqService.submitQuotation(rfq._id, {
        supplierId: suppliers[0]._id,
        items: [
          { productId: products[0]._id, variantId: products[0].variants[0]._id, unitPrice: products[0].costPrice },
          { productId: products[1]._id, variantId: products[1].variants[0]._id, unitPrice: products[1].costPrice },
        ],
      });
      await rfqService.submitQuotation(rfq._id, {
        supplierId: suppliers[1]._id,
        items: [
          { productId: products[0]._id, variantId: products[0].variants[0]._id, unitPrice: products[0].costPrice * 0.95 },
          { productId: products[1]._id, variantId: products[1].variants[0]._id, unitPrice: products[1].costPrice * 1.05 },
        ],
      });
      ok('RFQ', 'created 1 RFQ with 2 supplier quotations');
    } else {
      skip('RFQ', 'not enough products/suppliers available');
    }
  } catch (err) { fail('RFQ', err); }

  // ---------------------------------------------------------------------
  // 17. Banking — one inter-account transfer (Cash -> Bank)
  // ---------------------------------------------------------------------
  try {
    if (bank && cash) {
      await accountingService.postVoucher({
        companyId: company._id, branchId: branch._id, type: 'transfer', narration: 'Demo seed: cash deposit to bank',
        entries: [
          { accountId: bank._id, debit: 20000, credit: 0 },
          { accountId: cash._id, debit: 0, credit: 20000 },
        ],
        userId: admin._id,
      });
      ok('Banking', 'posted a 20000 Cash → Bank transfer voucher');
    } else {
      skip('Banking', 'Cash or Bank account not found');
    }
  } catch (err) { fail('Banking', err); }

  // ---------------------------------------------------------------------
  console.log('\n================ DEMO DATA SEED SUMMARY ================');
  summary.forEach((line) => console.log(line));
  console.log('==========================================================\n');
  console.log('Log in as admin@demo.test / password123 to see the data.');

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error running seedDemoData:', err);
  process.exit(1);
});
