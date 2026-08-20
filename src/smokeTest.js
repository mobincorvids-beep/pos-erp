/**
 * End-to-end smoke test — exercises every real interlink between modules
 * against an ACTUAL MongoDB, not just require()-walked for import errors.
 * This is what genuinely proves the system works, as opposed to "every
 * file loads without throwing" which is all syntax-checking can promise.
 *
 * Run with: npm run smoke-test  (requires MONGO_URI in .env pointing at a
 * real, empty-is-fine MongoDB — this creates its own throwaway company so
 * it's safe to run against a dev database repeatedly)
 *
 * Fails fast: the first assertion that doesn't hold stops the script with
 * a non-zero exit code and a clear message, rather than silently continuing.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { nanoid } = require('nanoid');

const Account = require('./models/Account');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Supplier = require('./models/Supplier');
const Company = require('./models/Company');
const Sale = require('./models/Sale');

const companyProvisioningService = require('./services/companyProvisioningService');
const inventoryService = require('./services/inventoryService');
const posSaleService = require('./services/posSaleService');
const saleReturnService = require('./services/saleReturnService');
const customerLedgerService = require('./services/customerLedgerService');
const requisitionService = require('./services/requisitionService');
const purchaseService = require('./services/purchaseService');
const projectService = require('./services/projectService');
const expenseService = require('./services/expenseService');
const hrService = require('./services/hrService');
const consolidatedReportService = require('./services/consolidatedReportService');
const ecommerceService = require('./services/ecommerceService');
const aiInsightsService = require('./services/aiInsightsService');
const taxComplianceService = require('./services/taxComplianceService');
const reportingService = require('./services/reportingService');
const salonService = require('./modules/salon/services/salonService');
const jewelryPricingService = require('./modules/jewelry/services/jewelryPricingService');
const buybackService = require('./modules/jewelry/services/buybackService');
const hotelService = require('./modules/hotel/services/hotelService');
const schoolService = require('./modules/school/services/schoolService');
const distributionPricingService = require('./modules/distribution/services/distributionPricingService');
const bookingService = require('./modules/banquet/services/bookingService');
const vehicleService = require('./modules/service_station/services/vehicleService');
const fitmentService = require('./modules/auto_parts/services/fitmentService');
const hospitalService = require('./modules/hospital/services/hospitalService');
const gymService = require('./modules/gym/services/gymService');
const warrantyService = require('./modules/electronics/services/warrantyService');
const furnitureService = require('./modules/furniture/services/furnitureService');
const manufacturingService = require('./services/manufacturingService');
const markdownService = require('./modules/fashion/services/markdownService');
const dailyBatchService = require('./modules/bakery/services/dailyBatchService');
const fefoService = require('./modules/grocery/services/fefoService');
const sizeCurveService = require('./modules/footwear/services/sizeCurveService');
const fabricRollService = require('./modules/textile/services/fabricRollService');
const toolRentalService = require('./modules/hardware/services/toolRentalService');
const layawayService = require('./modules/retail/services/layawayService');
const cafeSubscriptionService = require('./modules/cafe/services/cafeSubscriptionService');
const giftRegistryService = require('./modules/toys_gifts/services/giftRegistryService');
const fuelShiftService = require('./modules/petrol_pump/services/fuelShiftService');
const shipmentService = require('./modules/courier/services/shipmentService');
const dairyCollectionService = require('./modules/dairy/services/dairyCollectionService');
const carRentalService = require('./modules/car_rental/services/carRentalService');
const storageContractService = require('./modules/warehouse_3pl/services/storageContractService');
const tradeInService = require('./modules/automobile/services/tradeInService');
const crmService = require('./services/crmService');

let stepNumber = 0;
function assert(condition, message) {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}
async function step(label, fn) {
  stepNumber += 1;
  try {
    const result = await fn();
    console.log(`✓ ${stepNumber}. ${label}`);
    return result;
  } catch (err) {
    console.error(`✗ ${stepNumber}. ${label}`);
    console.error(`  ${err.message}`);
    throw err;
  }
}

async function run() {
  await connectDB();
  const suffix = nanoid(6).toLowerCase();

  // --- 1. Onboarding (Company & Org Management, Accounting starter chart) ---
  const { company, branch, warehouse } = await step('Onboard a company', () =>
    companyProvisioningService.onboardCompany({
      name: `Smoke Test Co ${suffix}`, industryType: 'retail',
      adminName: 'Smoke Admin', adminEmail: `smoke-${suffix}@test.local`,
    })
  );

  const accounts = await Account.find({ companyId: company._id });
  const byName = (re) => accounts.find((a) => re.test(a.name));
  const cash = byName(/^Cash$/);
  const revenueAcc = byName(/Sales Revenue/);
  const receivableAcc = byName(/Receivable/);
  const salariesAcc = byName(/Salar/);
  assert(cash && revenueAcc && receivableAcc && salariesAcc, 'starter chart of accounts includes Cash, Sales Revenue, Accounts Receivable, Salaries Expense');

  // --- 2. Product & Inventory ---
  const product = await step('Create a product with opening stock', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Smoke Widget', sku: `SW-${suffix}`, barcode: `${suffix}000`,
      trackingMode: 'simple', costPrice: 50, sellingPrice: 100, reorderLevel: 5,
      variants: [{ sku: `SW-${suffix}`, barcode: `${suffix}000`, sellingPrice: 100 }],
    });
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
      type: 'purchase', quantity: 100, unitCost: 50, note: 'Smoke test opening stock',
    });
    return p;
  });
  const variantId = product.variants[0]._id;

  // --- 3. POS checkout, void, return (POS & Sales) ---
  const customer = await step('Create a customer', () =>
    Customer.create({ companyId: company._id, name: 'Smoke Customer' })
  );

  const sale1 = await step('Checkout a sale (2 units, full payment)', () =>
    posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 2, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 200 }],
    })
  );
  assert(sale1.status === 'completed' && sale1.totalAmount === 200, 'sale1 completed at correct total');

  await step('Stock decremented by the sale', async () => {
    const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
    assert(qty === 98, `expected 98 in stock after selling 2 of 100, got ${qty}`);
  });

  await step('Void the sale reverses stock and ledger', async () => {
    await saleReturnService.voidSale(sale1._id, { userId: null, reason: 'smoke test void' });
    const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
    assert(qty === 100, `expected stock restored to 100 after void, got ${qty}`);
  });

  const sale2 = await step('Checkout a second sale (5 units, partial payment — creates a due balance)', () =>
    posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 5, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 300 }],
    })
  );
  assert(sale2.dueAmount === 200, `expected 200 due on sale2, got ${sale2.dueAmount}`);

  await step('Return 1 unit from sale2', async () => {
    await saleReturnService.processReturn(sale2._id, {
      items: [{ productId: product._id, variantId, quantity: 1 }],
      refundAccountId: cash._id, reason: 'smoke test return', userId: null,
    });
    const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
    assert(qty === 96, `expected 96 in stock after selling 5 (net of void) and returning 1, got ${qty}`);
  });

  // --- 4. Customer ledger (Customer Management) ---
  await step('Record a customer payment, auto-allocated to the due sale', async () => {
    await customerLedgerService.recordPayment({
      companyId: company._id, customerId: customer._id, paymentAccountId: cash._id, amount: 200,
      receivableAccountId: receivableAcc._id, date: new Date(),
    });
    const ledger = await customerLedgerService.ledger(customer._id);
    assert(ledger.closingBalance === 0, `expected customer balance to reach 0 after paying off the due amount, got ${ledger.closingBalance}`);
  });

  // --- 5. Procurement: requisition -> quote -> PO -> approve -> receive -> QC ---
  const supplier = await step('Create a supplier', () =>
    Supplier.create({ companyId: company._id, name: 'Smoke Supplier' })
  );

  const requisition = await step('Create + approve a requisition', async () => {
    const req = await requisitionService.create({
      companyId: company._id, branchId: branch._id,
      items: [{ productId: product._id, variantId, quantityRequested: 20 }], requestedBy: null,
    });
    return requisitionService.decide(req._id, { approve: true, userId: null });
  });

  const po = await step('Create a PO from the requisition, then approve it', async () => {
    const created = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      requisitionId: requisition._id,
      items: [{ productId: product._id, variantId, quantityOrdered: 20, unitCost: 45 }],
      userId: null,
    });
    return purchaseService.decidePurchaseOrder(created._id, { approve: true, userId: null });
  });
  assert(po.status === 'ordered', `expected PO status "ordered" after approval, got "${po.status}"`);

  const stockBeforeReceive = await inventoryService.getStockLevel(warehouse._id, variantId);
  const grn = await step('Receive the PO (partial: 15 of 20)', () =>
    purchaseService.receiveGoods({
      purchaseOrderId: po._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: po.items[0]._id, productId: product._id, variantId, quantity: 15, unitCost: 45 }],
      userId: null,
    })
  );

  await step('Stock increased by exactly what was received', async () => {
    const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
    assert(qty === stockBeforeReceive + 15, `expected +15 stock from GRN, got ${qty - stockBeforeReceive}`);
  });

  await step('Over-receiving beyond what remains is rejected', async () => {
    let threw = false;
    try {
      await purchaseService.receiveGoods({
        purchaseOrderId: po._id, warehouseId: warehouse._id,
        items: [{ purchaseOrderItemId: po.items[0]._id, productId: product._id, variantId, quantity: 999, unitCost: 45 }],
        userId: null,
      });
    } catch { threw = true; }
    assert(threw, 'expected receiveGoods to reject a quantity exceeding what remains outstanding');
  });

  // --- 5b. Serial number consumption at sale time (receive with serials -> sell a specific one -> return it -> void a different one) ---
  const ProductSerial = require('./models/ProductSerial');
  const serialProduct = await step('Create a serial-tracked product and receive 3 units with serial numbers', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Smoke Phone', sku: `PH-${suffix}`,
      trackingMode: 'serial', costPrice: 500, sellingPrice: 800,
      variants: [{ sku: `PH-${suffix}`, sellingPrice: 800 }],
    });
    const phonePo = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      items: [{ productId: p._id, variantId: p.variants[0]._id, quantityOrdered: 3, unitCost: 500 }], userId: null,
    });
    await purchaseService.decidePurchaseOrder(phonePo._id, { approve: true, userId: null });
    await purchaseService.receiveGoods({
      purchaseOrderId: phonePo._id, warehouseId: warehouse._id,
      items: [{
        purchaseOrderItemId: phonePo.items[0]._id, productId: p._id, variantId: p.variants[0]._id,
        quantity: 3, unitCost: 500, serialNumbers: [`SN-${suffix}-1`, `SN-${suffix}-2`, `SN-${suffix}-3`],
      }],
      userId: null,
    });
    const serials = await ProductSerial.find({ variantId: p.variants[0]._id });
    assert(serials.length === 3 && serials.every((s) => s.status === 'in_stock'), 'all 3 serials created and in_stock after receiving');
    return p;
  });
  const serialVariantId = serialProduct.variants[0]._id;

  const serialSale = await step('Sell one specific serial — it gets marked sold and linked to the sale', async () => {
    const sale = await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: serialProduct._id, variantId: serialVariantId, quantity: 1, unitPrice: 800, serialNumbers: [`SN-${suffix}-1`] }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 800 }],
    });
    const sold = await ProductSerial.findOne({ variantId: serialVariantId, serialNumber: `SN-${suffix}-1` });
    assert(sold.status === 'sold' && String(sold.saleId) === String(sale._id), 'sold serial marked sold and linked to the sale');

    let threw = false;
    try {
      await posSaleService.checkout({
        companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
        items: [{ productId: serialProduct._id, variantId: serialVariantId, quantity: 1, unitPrice: 800, serialNumbers: [`SN-${suffix}-1`] }],
        payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 800 }],
      });
    } catch { threw = true; }
    assert(threw, 'selling the same already-sold serial again is rejected');

    return sale;
  });

  await step('Returning that serial releases it back to in_stock', async () => {
    await saleReturnService.processReturn(serialSale._id, {
      items: [{ productId: serialProduct._id, variantId: serialVariantId, quantity: 1, serialNumbers: [`SN-${suffix}-1`] }],
      refundAccountId: cash._id, reason: 'smoke test serial return', userId: null,
    });
    const released = await ProductSerial.findOne({ variantId: serialVariantId, serialNumber: `SN-${suffix}-1` });
    assert(released.status === 'in_stock' && released.saleId === null, 'returned serial released back to in_stock with saleId cleared');
  });

  await step('Voiding a sale releases ALL its serials back to in_stock', async () => {
    const voidableSale = await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: serialProduct._id, variantId: serialVariantId, quantity: 1, unitPrice: 800, serialNumbers: [`SN-${suffix}-2`] }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 800 }],
    });
    await saleReturnService.voidSale(voidableSale._id, { userId: null, reason: 'smoke test serial void' });
    const released = await ProductSerial.findOne({ variantId: serialVariantId, serialNumber: `SN-${suffix}-2` });
    assert(released.status === 'in_stock', 'voided sale released its serial back to in_stock');
  });

  // --- 6. Projects & Job Costing (interlink: Expense + PurchaseOrder -> ProjectCost automatically) ---
  const project = await step('Create a project', () =>
    projectService.createProject({ companyId: company._id, name: 'Smoke Project', budget: 100000, customerId: customer._id })
  );

  await step('Approving a project-tagged expense auto-creates a ProjectCost', async () => {
    const ExpenseCategory = require('./models/ExpenseCategory');
    const category = await ExpenseCategory.create({ companyId: company._id, name: 'Smoke Category', accountId: salariesAcc._id });
    const expense = await expenseService.submitExpense({
      companyId: company._id, categoryId: category._id, paymentAccountId: cash._id,
      amount: 500, projectId: project._id, userId: null,
    });
    await expenseService.approveExpense(expense._id, null);

    const before = await projectService.profitability(project._id);
    assert(before.costBreakdown.expense === 500, `expected 500 expense cost on project, got ${before.costBreakdown.expense}`);
  });

  await step('Receiving against a project-tagged PO auto-creates a ProjectCost', async () => {
    const projectPo = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      projectId: project._id,
      items: [{ productId: product._id, variantId, quantityOrdered: 5, unitCost: 45 }], userId: null,
    });
    await purchaseService.decidePurchaseOrder(projectPo._id, { approve: true, userId: null });
    await purchaseService.receiveGoods({
      purchaseOrderId: projectPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: projectPo.items[0]._id, productId: product._id, variantId, quantity: 5, unitCost: 45 }],
      userId: null,
    });

    const report = await projectService.profitability(project._id);
    assert(report.costBreakdown.material === 225, `expected 225 material cost (5 x 45) on project, got ${report.costBreakdown.material}`);
  });

  await step('A project-tagged sale counts toward project revenue', async () => {
    await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id, projectId: project._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 100 }],
    });
    const report = await projectService.profitability(project._id);
    assert(report.revenue === 100, `expected 100 project revenue, got ${report.revenue}`);
    assert(report.profit === report.revenue - report.totalCost, 'profit = revenue - totalCost arithmetic holds');
  });

  // --- 7. HRMS & Payroll (interlink: Attendance -> Payroll -> Accounting) ---
  await step('Employee, attendance, payroll generate + post', async () => {
    const employee = await hrService.createEmployee({
      companyId: company._id, branchId: branch._id, name: 'Smoke Employee',
      salaryStructure: { basic: 30000, allowances: 2000, deductions: 0 },
    });

    const now = new Date();
    await hrService.markAttendance({ companyId: company._id, employeeId: employee._id, date: new Date(now.getFullYear(), now.getMonth(), 2), status: 'absent' });
    await hrService.markAttendance({ companyId: company._id, employeeId: employee._id, date: new Date(now.getFullYear(), now.getMonth(), 3), status: 'absent' });

    const run = await hrService.generatePayroll({ companyId: company._id, month: now.getMonth() + 1, year: now.getFullYear(), userId: null });
    assert(run.entries[0].absentDays === 2, `expected 2 absent days counted, got ${run.entries[0].absentDays}`);
    assert(run.entries[0].netPay < 32000, 'net pay should be reduced below basic+allowances by the absence deduction');

    const posted = await hrService.postPayroll(run._id, { paymentAccountId: cash._id, userId: null });
    assert(posted.status === 'posted' && posted.voucherId, 'payroll run posted with a voucher attached');
  });

  // --- 8. Multi-Company consolidation (group-of-one for this company) ---
  await step('Consolidated sales summary returns this company in its own group', async () => {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = new Date();
    const consolidated = await consolidatedReportService.consolidatedSalesSummary(company._id, from, to);
    assert(consolidated.companies.length === 1 && String(consolidated.companies[0].companyId) === String(company._id), 'group-of-one contains exactly this company');
  });

  // --- 9. E-commerce (interlink: reuses posSaleService.checkout) ---
  await step('E-commerce order import creates a real, channel-tagged sale', async () => {
    const freshCompany = await Company.findById(company._id);
    await ecommerceService.enableAndRotateToken(freshCompany, {
      defaultBranchId: branch._id, defaultWarehouseId: warehouse._id, defaultPaymentAccountId: cash._id,
    });
    const ecomSale = await ecommerceService.importOrder(freshCompany, {
      items: [{ barcode: `${suffix}000`, quantity: 1, unitPrice: 100 }],
      customerEmail: `ecom-${suffix}@test.local`, customerName: 'Ecom Customer',
    });
    assert(ecomSale.channel === 'ecommerce', 'imported order is tagged channel: ecommerce');

    const savedSale = await Sale.findById(ecomSale._id);
    assert(savedSale.channel === 'ecommerce', 'channel persisted to the database, not just the in-memory object');
  });

  // --- 10. AI/BI + Reports (read-only, over everything written above) ---
  await step('AI briefing runs without error and returns findings', async () => {
    const briefing = await aiInsightsService.briefing(company._id);
    assert(Array.isArray(briefing.findings) && briefing.findings.length > 0, 'briefing returns at least one finding');
  });

  await step('New report types all run without error', async () => {
    await reportingService.lowStockReport(company._id);
    await reportingService.topProductsReport(company._id, new Date(Date.now() - 30 * 86400000), new Date());
    await reportingService.salespersonPerformanceReport(company._id, new Date(Date.now() - 30 * 86400000), new Date());
    await reportingService.branchComparisonReport(company._id, new Date(Date.now() - 30 * 86400000), new Date());
    await reportingService.stockMovementReport(company._id, null, new Date(Date.now() - 30 * 86400000), new Date());
  });

  // --- 11. Tax compliance dispatcher (no authorities registered -> must be a safe no-op, never a crash) ---
  await step('Tax compliance dispatcher is a safe no-op when no authority is registered', async () => {
    const results = await taxComplianceService.submitForCompliance(sale2._id);
    assert(Array.isArray(results) && results.length === 0, 'no taxAuthorities registered -> empty results, no network call attempted');
  });

  // --- 12. Salon industry module: service billing with staff commission, memberships, commission -> payroll interlink ---
  const Company = require('./models/Company');
  await step('Enable the salon module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'salon' } });
  });

  const salonEmployee = await step('Create a stylist employee', () =>
    hrService.createEmployee({
      companyId: company._id, branchId: branch._id, name: 'Smoke Stylist',
      salaryStructure: { basic: 25000, allowances: 0, deductions: 0 },
    })
  );

  const haircutProduct = await step('Create the sellable line-item product a salon service bills as (trackingMode "service" — no stock to hold, correctly excluded from checkout\'s inventory checks by bundleService)', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Haircut', sku: `HC-${suffix}`,
      trackingMode: 'service', costPrice: 0, sellingPrice: 1500,
      variants: [{ sku: `HC-${suffix}`, sellingPrice: 1500 }],
    });
    return p;
  });

  const salonSvc = await step('Create a salon service with a 20% commission rate', () =>
    salonService.createService({
      companyId: company._id, productId: haircutProduct._id, variantId: haircutProduct.variants[0]._id,
      name: 'Haircut', price: 1500, commissionType: 'percentage', commissionRate: 20,
    })
  );

  await step('Bill a service performed by the stylist — records a commission and a real Sale', async () => {
    const result = await salonService.billServiceWithCommission({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      salonServiceId: salonSvc._id, employeeId: salonEmployee._id, paymentAccountId: cash._id, userId: null,
    });
    assert(result.sale.totalAmount === 1500, `expected sale total 1500, got ${result.sale.totalAmount}`);
    assert(result.commission.amount === 300, `expected 20% commission of 1500 = 300, got ${result.commission.amount}`);
    assert(result.commission.status === 'unpaid', 'commission starts unpaid, folded into payroll later');

    // Proves the core fix actually works: a service line creates NO
    // StockLevel record at all — checkout never attempted to check or
    // deduct stock for it, because bundleService.expandItem() resolves a
    // 'service'-tracked product to nothing before stock logic ever sees it.
    const StockLevel = require('./models/StockLevel');
    const stockRecord = await StockLevel.findOne({ variantId: haircutProduct.variants[0]._id });
    assert(stockRecord === null, 'a service line item must never create a StockLevel record — services are not stock');
  });

  const membershipProduct = await step('Create the product a membership package bills as (also trackingMode "service")', async () => {
    const p = await Product.create({
      companyId: company._id, name: '5-Haircut Package', sku: `PKG-${suffix}`,
      trackingMode: 'service', costPrice: 0, sellingPrice: 6000,
      variants: [{ sku: `PKG-${suffix}`, sellingPrice: 6000 }],
    });
    return p;
  });
  const pkg = await salonService.createMembershipPackage({
    companyId: company._id, productId: membershipProduct._id, variantId: membershipProduct.variants[0]._id,
    name: '5-Haircut Package', salonServiceId: salonSvc._id, totalSessions: 5, price: 6000, validityDays: 180,
  });

  await step('Sell a membership package — creates a real Sale plus session credit', async () => {
    const { sale, membership } = await salonService.sellMembership({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      membershipPackageId: pkg._id, paymentAccountId: cash._id, userId: null,
    });
    assert(sale.totalAmount === 6000, `expected package sale total 6000, got ${sale.totalAmount}`);
    assert(membership.remainingSessions === 5, `expected 5 remaining sessions, got ${membership.remainingSessions}`);
  });

  await step('Redeem a membership session — bills at zero payment but still earns commission', async () => {
    const before = await salonService.listCustomerMemberships(company._id, customer._id);
    const activeMembership = before.find((m) => m.status === 'active');
    assert(activeMembership, 'an active membership exists to redeem against');

    const result = await salonService.billServiceWithCommission({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      salonServiceId: salonSvc._id, employeeId: salonEmployee._id, useMembership: true, userId: null,
    });
    assert(result.sale.totalAmount === 0, `expected a zero-charge sale for a membership redemption, got ${result.sale.totalAmount}`);
    assert(result.commission.amount === 300, 'commission still earned on the service\'s real price even though the customer paid nothing this visit');
    assert(result.membership.remainingSessions === 4, `expected 4 remaining sessions after redemption, got ${result.membership.remainingSessions}`);
  });

  await step('Applying commissions to payroll folds them into the draft via the generic core hook, not a salon-specific payroll path', async () => {
    // Use a month clearly distinct from the one the earlier HRMS test already
    // generated a payroll run for for this company, so the unique
    // (companyId, month, year) index on PayrollRun doesn't collide.
    const targetMonth = 6, targetYear = 2099;
    const targetFrom = new Date(targetYear, targetMonth - 1, 15);

    const StaffCommission = require('./modules/salon/models/StaffCommission');
    const [testCommission] = await StaffCommission.create([{
      companyId: company._id, employeeId: salonEmployee._id, salonServiceId: salonSvc._id,
      saleId: new mongoose.Types.ObjectId(), // applyCommissionsToPayroll never dereferences saleId, only sums amount by employee/date — any valid ObjectId is fine here
      amount: 450, status: 'unpaid', earnedAt: targetFrom,
    }]);

    const run = await hrService.generatePayroll({ companyId: company._id, month: targetMonth, year: targetYear, userId: null });
    const applied = await salonService.applyCommissionsToPayroll(run._id, targetMonth, targetYear, company._id);

    assert(applied.length === 1 && applied[0].amount === 450, `expected exactly one employee with 450 applied, got ${JSON.stringify(applied)}`);

    const PayrollRun = require('./models/PayrollRun');
    const updatedRun = await PayrollRun.findById(run._id);
    const entry = updatedRun.entries.find((e) => String(e.employeeId) === String(salonEmployee._id));
    assert(entry.bonuses === 450, `expected bonuses field to be 450 after applying the commission, got ${entry.bonuses}`);

    const refreshedCommission = await StaffCommission.findById(testCommission._id);
    assert(refreshedCommission.status === 'paid' && String(refreshedCommission.payrollRunId) === String(run._id), 'commission marked paid and linked to the payroll run it was applied to');
  });

  // --- 13. Jewelry industry module: live weight-based pricing + buy-back credit ---
  await step('Enable the jewelry module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'jewelry' } });
  });

  const jewelryProduct = await step('Create a weight-based product — exercises the core trackingMode "weight"/isWeightBased fields that existed but were never used anywhere until this module', async () => {
    return Product.create({
      companyId: company._id, name: '22k Gold Ring', sku: `RING-${suffix}`,
      trackingMode: 'weight', isWeightBased: true, costPrice: 0, sellingPrice: 0, // sellingPrice is intentionally 0/unused — jewelry price is always computed live, never read from here
      variants: [{ sku: `RING-${suffix}`, weight: 5.5 }], // 5.5 grams
    });
  });
  const jewelryVariantId = jewelryProduct.variants[0]._id;

  await step('Set today\'s gold rate and configure the item\'s karat/making charge', async () => {
    await jewelryPricingService.setGoldRate(company._id, 22, 20000); // PKR 20,000/gram for 22k
    await jewelryPricingService.configureItem({
      companyId: company._id, productId: jewelryProduct._id, variantId: jewelryVariantId,
      karat: 22, makingChargeType: 'percentage', makingChargeValue: 10, stoneCharge: 500,
    });
  });

  const quote = await step('Quote the live price — hand-traced: 5.5g × 20000 = 110000 gold value, +10% making charge (11000), +500 stone charge', async () => {
    const q = await jewelryPricingService.quotePrice(company._id, jewelryVariantId);
    assert(q.goldValue === 110000, `expected goldValue 110000 (5.5 × 20000), got ${q.goldValue}`);
    assert(q.makingCharge === 11000, `expected makingCharge 11000 (10% of 110000), got ${q.makingCharge}`);
    assert(q.totalPrice === 121500, `expected totalPrice 121500 (110000 + 11000 + 500), got ${q.totalPrice}`);
    return q;
  });

  await step('Give the jewelry item opening stock, then sell it at the quoted price through the normal checkout', async () => {
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: jewelryProduct._id, variantId: jewelryVariantId,
      type: 'adjustment', quantity: 1, note: 'Smoke test opening stock for weight-based item',
    });
    const sale = await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: jewelryProduct._id, variantId: jewelryVariantId, quantity: 1, unitPrice: quote.totalPrice }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: quote.totalPrice }],
    });
    assert(sale.totalAmount === 121500, `expected the sale to bill at the quoted live price 121500, got ${sale.totalAmount}`);
  });

  await step('Buy-back intake computes credit from weight, deduction, and the current rate — hand-traced: 10g × (1 - 5%) × 20000 = 190000', async () => {
    const buyback = await buybackService.intake({
      companyId: company._id, customerId: customer._id, karat: 22, weightGrams: 10, deductionPercent: 5, userId: null,
    });
    assert(buyback.creditAmount === 190000, `expected creditAmount 190000 (10 × 0.95 × 20000), got ${buyback.creditAmount}`);
    assert(buyback.status === 'pending', 'buyback starts pending until applied to a sale');

    const linkedSale = await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100, discountAmount: 100 }], // the buyback credit applied as a per-line discount, same pattern as loyalty redemption
      payments: [],
    });
    const applied = await buybackService.markApplied(buyback._id, linkedSale._id);
    assert(applied.status === 'applied' && String(applied.saleId) === String(linkedSale._id), 'buyback marked applied and linked to the sale it credited');
  });

  // --- 14. Hotel industry module: date-range room availability, advance deposit -> liability -> revenue interlink ---
  await step('Enable the hotel module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'hotel' } });
  });

  const roomChargeProduct = await step('Create the room-night billing product — trackingMode "service", no stock involved', async () => {
    return Product.create({
      companyId: company._id, name: 'Room Charge', sku: `ROOM-${suffix}`,
      trackingMode: 'service', costPrice: 0, sellingPrice: 0,
      variants: [{ sku: `ROOM-${suffix}`, sellingPrice: 0 }],
    });
  });

  const room = await step('Create a room', () =>
    hotelService.createRoom({
      companyId: company._id, branchId: branch._id, roomNumber: `10${suffix.slice(0, 1)}`, roomType: 'Deluxe',
      ratePerNight: 8000, billingProductId: roomChargeProduct._id, billingVariantId: roomChargeProduct.variants[0]._id,
    })
  );

  const depositLiabilityAccount = await step('Create a "Guest Deposits" liability account for the advance-deposit interlink', () =>
    Account.create({ companyId: company._id, name: 'Guest Deposits', type: 'liability' })
  );

  const checkIn = new Date();
  const checkOut = new Date(checkIn.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 nights

  const reservation = await step('Book a 3-night reservation with a partial advance deposit — posts Dr Cash Cr Guest Deposits', async () => {
    const r = await hotelService.bookReservation({
      companyId: company._id, branchId: branch._id, roomId: room._id, customerId: customer._id,
      checkInDate: checkIn, checkOutDate: checkOut,
      advanceAmount: 10000, advanceReceivedInAccountId: cash._id, depositLiabilityAccountId: depositLiabilityAccount._id,
      userId: null,
    });
    assert(r.status === 'booked', `expected status "booked", got "${r.status}"`);
    return r;
  });

  await step('The same room cannot be double-booked for an overlapping date range', async () => {
    const overlapStart = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000); // day 2 of the existing stay
    const overlapEnd = new Date(overlapStart.getTime() + 2 * 24 * 60 * 60 * 1000);
    let threw = false;
    try {
      await hotelService.bookReservation({
        companyId: company._id, branchId: branch._id, roomId: room._id, customerId: customer._id,
        checkInDate: overlapStart, checkOutDate: overlapEnd, userId: null,
      });
    } catch { threw = true; }
    assert(threw, 'expected an overlapping reservation for the same room to be rejected');
  });

  await step('A non-overlapping date range for the same room IS available (starts exactly on checkout day)', async () => {
    const available = await hotelService.isRoomAvailable(room._id, checkOut, new Date(checkOut.getTime() + 24 * 60 * 60 * 1000));
    assert(available === true, 'checkout day itself should not count as occupied — a new guest can check in the same day');
  });

  await step('Check in, add an extra charge, then check out — bills 3 nights + extras, hand-traced: 3×8000=24000 room + 1500 extra = 25500 total, minus 10000 advance = 15500 remaining', async () => {
    await hotelService.checkIn(reservation._id);

    const roomAfterCheckIn = await require('./modules/hotel/models/Room').findById(room._id);
    assert(roomAfterCheckIn.status === 'occupied', `expected room status "occupied" after check-in, got "${roomAfterCheckIn.status}"`);

    await hotelService.addExtraCharge(reservation._id, {
      productId: product._id, variantId, description: 'Minibar', quantity: 1, unitPrice: 1500,
    });

    const result = await hotelService.checkOut(reservation._id, {
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: null,
    });

    assert(result.nights === 3, `expected 3 nights, got ${result.nights}`);
    assert(result.roomTotal === 24000, `expected roomTotal 24000 (3 × 8000), got ${result.roomTotal}`);
    assert(result.grandTotal === 25500, `expected grandTotal 25500 (24000 + 1500), got ${result.grandTotal}`);
    assert(result.advanceApplied === 10000, `expected the full 10000 advance applied, got ${result.advanceApplied}`);
    assert(result.remaining === 15500, `expected remaining 15500 (25500 - 10000), got ${result.remaining}`);
    assert(result.sale.totalAmount === 25500, `expected the Sale itself to total 25500, got ${result.sale.totalAmount}`);
    assert(result.reservation.status === 'checked_out', `expected reservation status "checked_out", got "${result.reservation.status}"`);

    const roomAfterCheckOut = await require('./modules/hotel/models/Room').findById(room._id);
    assert(roomAfterCheckOut.status === 'cleaning', `expected room status "cleaning" after check-out (needs housekeeping before resale), got "${roomAfterCheckOut.status}"`);
  });

  await step('The advance deposit liability was correctly cleared by check-out\'s voucher (debited by advanceApplied), not left sitting on the books', async () => {
    const consolidated = await reportingService.trialBalance(company._id);
    const depositRow = consolidated.accounts.find((a) => String(a.accountId) === String(depositLiabilityAccount._id));
    // The account started with a 10000 credit (the advance) at booking, then
    // was debited 10000 at check-out (applied as a checkout "payment") —
    // net balance should be back to zero, proving the SAME core voucher
    // logic that handles a normal cash payment correctly cleared a liability instead.
    assert(depositRow && Math.abs(depositRow.debit - depositRow.credit) < 0.01, `expected the Guest Deposits liability to net to zero after being fully applied, got debit=${depositRow?.debit} credit=${depositRow?.credit}`);
  });

  await step('Marking the room clean returns it to available', async () => {
    const cleaned = await hotelService.markRoomClean(room._id);
    assert(cleaned.status === 'available', `expected room status "available" after cleaning, got "${cleaned.status}"`);
  });

  // --- 15. School industry module: batch fee-invoice generation across many students for one period ---
  await step('Enable the school module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'school' } });
  });

  const tuitionProduct = await step('Create the tuition billing product — trackingMode "service"', () =>
    Product.create({
      companyId: company._id, name: 'Monthly Tuition', sku: `TUI-${suffix}`,
      trackingMode: 'service', costPrice: 0, sellingPrice: 0,
      variants: [{ sku: `TUI-${suffix}`, sellingPrice: 0 }],
    })
  );

  const [studentA, studentB, studentInactive] = await step('Enroll 3 students in the same class, one already inactive (withdrawn)', () =>
    Promise.all([
      schoolService.createStudent({ companyId: company._id, branchId: branch._id, name: 'Student A', className: 'Grade 5' }),
      schoolService.createStudent({ companyId: company._id, branchId: branch._id, name: 'Student B', className: 'Grade 5' }),
      schoolService.createStudent({ companyId: company._id, branchId: branch._id, name: 'Student C (withdrawn)', className: 'Grade 5' }),
    ])
  );
  const Student = require('./modules/school/models/Student');
  await Student.findByIdAndUpdate(studentInactive._id, { status: 'inactive' });

  const feeStructure = await step('Create a Grade 5 monthly tuition fee structure', () =>
    schoolService.createFeeStructure({
      companyId: company._id, name: 'Grade 5 Tuition', className: 'Grade 5', amount: 5000,
      billingProductId: tuitionProduct._id, billingVariantId: tuitionProduct.variants[0]._id, frequency: 'monthly',
    })
  );

  await step('Generating invoices for a period creates exactly one per ACTIVE eligible student, skipping the withdrawn one', async () => {
    const result = await schoolService.generateFeeInvoices({
      companyId: company._id, feeStructureId: feeStructure._id, period: '2026-08', dueDate: new Date('2026-08-10'),
    });
    assert(result.created.length === 2, `expected exactly 2 invoices created (2 active students in Grade 5), got ${result.created.length}`);
    assert(result.totalEligible === 2, `expected totalEligible 2 (the withdrawn student is status inactive, correctly excluded from the query), got ${result.totalEligible}`);
    assert(result.created.every((inv) => inv.amount === 5000), 'every generated invoice carries the fee structure\'s amount');
  });

  await step('Re-running generation for the SAME period is idempotent — zero new invoices, not duplicates or an error', async () => {
    const result = await schoolService.generateFeeInvoices({
      companyId: company._id, feeStructureId: feeStructure._id, period: '2026-08', dueDate: new Date('2026-08-10'),
    });
    assert(result.created.length === 0, `expected 0 newly created on a re-run for the same period, got ${result.created.length}`);
    assert(result.skippedCount === 2, `expected both students skipped as already-invoiced, got ${result.skippedCount}`);
  });

  await step('Paying an invoice bills through the ordinary checkout and marks it paid', async () => {
    const invoices = await schoolService.listInvoices(company._id, { studentId: studentA._id, period: '2026-08' });
    assert(invoices.length === 1, `expected exactly one invoice for student A this period, got ${invoices.length}`);

    const { sale, invoice } = await schoolService.payInvoice(invoices[0]._id, {
      branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null,
    });
    assert(sale.totalAmount === 5000, `expected the tuition sale to total 5000, got ${sale.totalAmount}`);
    assert(invoice.status === 'paid' && String(invoice.saleId) === String(sale._id), 'invoice marked paid and linked to the sale that paid it');
  });

  await step('An invoice past its due date gets flagged overdue on demand, not automatically', async () => {
    const pastDue = await schoolService.generateFeeInvoices({
      companyId: company._id, feeStructureId: feeStructure._id, period: '2020-01', dueDate: new Date('2020-01-10'),
    });
    assert(pastDue.created.length === 2, 'a distinct (already-past) period generates its own fresh invoices, unaffected by the 2026-08 idempotency check above');

    const flaggedCount = await schoolService.flagOverdueInvoices(company._id);
    assert(flaggedCount >= 1, `expected at least 1 invoice flagged overdue (the 2020-01 ones are years past due), got ${flaggedCount}`);

    const overdue = await schoolService.listInvoices(company._id, { period: '2020-01' });
    assert(overdue.every((inv) => inv.status === 'overdue'), 'every 2020-01 invoice is now marked overdue');
  });

  await step('Student attendance marks and re-marks the same day idempotently (upsert, not a duplicate record)', async () => {
    const today = new Date();
    await schoolService.markAttendance({ companyId: company._id, studentId: studentA._id, date: today, status: 'present' });
    await schoolService.markAttendance({ companyId: company._id, studentId: studentA._id, date: today, status: 'absent' }); // correcting the same day
    const rows = await schoolService.attendanceForMonth(studentA._id, today.getMonth() + 1, today.getFullYear());
    const todaysRows = rows.filter((r) => r.date.toDateString() === today.toDateString());
    assert(todaysRows.length === 1 && todaysRows[0].status === 'absent', `expected exactly one attendance record for today with the corrected status "absent", got ${JSON.stringify(todaysRows)}`);
  });

  // --- 16. Distribution industry module: quantity-tiered pricing + interlink with the EARLIER Sales Orders module, not checkout ---
  await step('Enable the distribution module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'distribution' } });
  });

  const wholesaleProduct = await step('Create a wholesale product with opening stock', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Bulk Widget', sku: `BULK-${suffix}`,
      trackingMode: 'simple', costPrice: 20, sellingPrice: 50, // 50 is the "retail" fallback price if no tier applies
      variants: [{ sku: `BULK-${suffix}`, sellingPrice: 50 }],
    });
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
      type: 'adjustment', quantity: 1000, note: 'Smoke test opening stock for wholesale item',
    });
    return p;
  });
  const wholesaleVariantId = wholesaleProduct.variants[0]._id;

  await step('Set a 3-tier price schedule with a minimum order quantity of 10', () =>
    distributionPricingService.setSchedule({
      companyId: company._id, productId: wholesaleProduct._id, variantId: wholesaleVariantId,
      minimumOrderQuantity: 10,
      tiers: [{ minQuantity: 10, unitPrice: 45 }, { minQuantity: 50, unitPrice: 40 }, { minQuantity: 100, unitPrice: 35 }],
    })
  );

  await step('An order below the minimum order quantity is rejected', async () => {
    let threw = false;
    try {
      await distributionPricingService.computePrice(company._id, wholesaleVariantId, 5);
    } catch { threw = true; }
    assert(threw, 'expected an order of 5 (below MOQ of 10) to be rejected');
  });

  await step('Quantity 25 lands in the 10-49 tier at 45/unit, not the 50+ tier at 40', async () => {
    const price = await distributionPricingService.computePrice(company._id, wholesaleVariantId, 25);
    assert(price.unitPrice === 45 && price.tierApplied === 10, `expected tier 10 (45/unit) for quantity 25, got tier ${price.tierApplied} at ${price.unitPrice}`);
  });

  await step('Quantity 100 lands in the top tier at 35/unit — hand-traced total: 100 × 35 = 3500', async () => {
    const quoted = await distributionPricingService.quoteOrder(company._id, [{ productId: wholesaleProduct._id, variantId: wholesaleVariantId, quantity: 100 }]);
    assert(quoted[0].unitPrice === 35 && quoted[0].tierApplied === 100, `expected tier 100 (35/unit), got tier ${quoted[0].tierApplied} at ${quoted[0].unitPrice}`);
    assert(quoted[0].lineTotal === 3500, `expected lineTotal 3500 (100 × 35), got ${quoted[0].lineTotal}`);
  });

  await step('quoteAndCreateSalesOrder creates a REAL Sales Order (core module) at the tiered price, not a checkout', async () => {
    const order = await distributionPricingService.quoteAndCreateSalesOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id, userId: null,
      items: [{ productId: wholesaleProduct._id, variantId: wholesaleVariantId, quantity: 100 }],
    });
    assert(order.saleType === 'sales_order' && order.status === 'sales_order', `expected a real sales_order document, got saleType="${order.saleType}" status="${order.status}"`);
    assert(order.totalAmount === 3500, `expected the sales order to total 3500 (the tiered price, not the 50 retail fallback × 100 = 5000), got ${order.totalAmount}`);
    assert(order.items[0].unitPrice === 35, `expected the sales order's line item to carry the tiered unitPrice 35, got ${order.items[0].unitPrice}`);

    // Confirms the interlink is real, not cosmetic: a sales order actually
    // RESERVES stock rather than deducting it (unlike a direct checkout,
    // which deducts immediately) — on-hand quantity is untouched, but
    // reservedQuantity increases by exactly the ordered amount. This is the
    // same reservation behavior every other sales order in the system
    // gets, proving this reused the actual core module rather than faking it.
    const StockLevel = require('./models/StockLevel');
    const level = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: wholesaleVariantId });
    assert(level.quantity === 1000, `expected on-hand quantity to remain 1000 (a sales order reserves, it doesn't deduct), got ${level.quantity}`);
    assert(level.reservedQuantity === 100, `expected reservedQuantity to be exactly 100 (the ordered quantity), got ${level.reservedQuantity}`);
  });

  // --- 17. Banquet industry module: per-headcount pricing + a 3-way cancellation voucher (forfeit + refund) ---
  await step('Enable the banquet module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'banquet' } });
  });

  const [cateringProduct, venueRentalProduct] = await step('Create the two billing products (catering per-person, venue rental flat) — both trackingMode "service"', () =>
    Promise.all([
      Product.create({
        companyId: company._id, name: 'Catering (per person)', sku: `CATER-${suffix}`,
        trackingMode: 'service', costPrice: 0, sellingPrice: 0,
        variants: [{ sku: `CATER-${suffix}`, sellingPrice: 0 }],
      }),
      Product.create({
        companyId: company._id, name: 'Venue Rental', sku: `VENUE-${suffix}`,
        trackingMode: 'service', costPrice: 0, sellingPrice: 0,
        variants: [{ sku: `VENUE-${suffix}`, sellingPrice: 0 }],
      }),
    ])
  );

  const venue = await step('Create a venue with a flat rental fee', () =>
    bookingService.createVenue({
      companyId: company._id, branchId: branch._id, name: 'Grand Hall', capacity: 300, baseRentalFee: 15000,
      rentalBillingProductId: venueRentalProduct._id, rentalBillingVariantId: venueRentalProduct.variants[0]._id,
    })
  );

  const eventPackage = await step('Create a per-person package', () =>
    bookingService.createPackage({
      companyId: company._id, name: 'Silver Package', pricePerPerson: 2000, minGuests: 50,
      billingProductId: cateringProduct._id, billingVariantId: cateringProduct.variants[0]._id,
    })
  );

  const eventDepositLiabilityAccount = await Account.create({ companyId: company._id, name: 'Event Deposits', type: 'liability' });

  const eventDate1 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const booking1 = await step('Book a 100-guest event with a deposit — hand-traced total: 100 × 2000 = 200000 catering + 15000 venue = 215000', async () => {
    const b = await bookingService.bookEvent({
      companyId: company._id, branchId: branch._id, venueId: venue._id, packageId: eventPackage._id, customerId: customer._id,
      eventDate: eventDate1, guestCount: 100,
      depositAmount: 50000, depositReceivedInAccountId: cash._id, depositLiabilityAccountId: eventDepositLiabilityAccount._id,
      userId: null,
    });
    assert(b.status === 'booked', `expected status "booked", got "${b.status}"`);
    return b;
  });

  await step('The same venue cannot be double-booked for the same calendar day', async () => {
    let threw = false;
    try {
      await bookingService.bookEvent({
        companyId: company._id, branchId: branch._id, venueId: venue._id, packageId: eventPackage._id, customerId: customer._id,
        eventDate: eventDate1, guestCount: 60, userId: null,
      });
    } catch { threw = true; }
    assert(threw, 'expected a second booking on the same venue+day to be rejected');
  });

  await step('Completing the event bills the per-headcount + venue rental through the ordinary checkout', async () => {
    const result = await bookingService.completeEvent(booking1._id, { warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: null });
    assert(result.guestTotal === 200000, `expected guestTotal 200000 (100 × 2000), got ${result.guestTotal}`);
    assert(result.grandTotal === 215000, `expected grandTotal 215000 (200000 + 15000), got ${result.grandTotal}`);
    assert(result.depositApplied === 50000, `expected the full 50000 deposit applied, got ${result.depositApplied}`);
    assert(result.remaining === 165000, `expected remaining 165000 (215000 - 50000), got ${result.remaining}`);
    assert(result.sale.totalAmount === 215000, `expected the Sale to total 215000, got ${result.sale.totalAmount}`);
  });

  const eventDate2 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const booking2 = await step('Book a second event on a different day, with a 30000 deposit, then cancel it', () =>
    bookingService.bookEvent({
      companyId: company._id, branchId: branch._id, venueId: venue._id, packageId: eventPackage._id, customerId: customer._id,
      eventDate: eventDate2, guestCount: 60,
      depositAmount: 30000, depositReceivedInAccountId: cash._id, depositLiabilityAccountId: eventDepositLiabilityAccount._id,
      userId: null,
    })
  );

  const cancellationRevenueAccount = await Account.create({ companyId: company._id, name: 'Cancellation Fee Revenue', type: 'income' });

  await step('Cancelling with a 40% forfeit splits the deposit into a 12000 cancellation-fee revenue and an 18000 refund — one voucher, three legs', async () => {
    await bookingService.cancelBooking(booking2._id, {
      forfeitPercent: 40, revenueAccountId: cancellationRevenueAccount._id, refundAccountId: cash._id, userId: null,
    });

    // Hand-traced: 30000 deposit × 40% = 12000 forfeited (revenue), 18000 refunded (cash).
    // Verified by pulling the actual voucher's entries, not just trusting the function didn't throw.
    const Voucher = require('./models/Voucher');
    const voucher = await Voucher.findOne({ referenceType: 'EventBooking', referenceId: booking2._id });
    assert(voucher, 'expected a voucher to have been posted for the cancellation');
    assert(voucher.entries.length === 3, `expected exactly 3 ledger entries (clear liability, credit revenue, credit cash refund), got ${voucher.entries.length}`);

    const liabilityLeg = voucher.entries.find((e) => String(e.accountId) === String(eventDepositLiabilityAccount._id));
    const revenueLeg = voucher.entries.find((e) => String(e.accountId) === String(cancellationRevenueAccount._id));
    const cashLeg = voucher.entries.find((e) => String(e.accountId) === String(cash._id));

    assert(liabilityLeg.debit === 30000, `expected the full 30000 deposit debited to clear the liability, got ${liabilityLeg?.debit}`);
    assert(revenueLeg.credit === 12000, `expected 12000 (40% of 30000) credited as forfeited revenue, got ${revenueLeg?.credit}`);
    assert(cashLeg.credit === 18000, `expected 18000 (the remaining 60%) credited to cash as the refund, got ${cashLeg?.credit}`);

    const totalDebit = voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(Math.abs(totalDebit - totalCredit) < 0.01, `expected the 3-leg voucher to still balance: debit ${totalDebit} vs credit ${totalCredit}`);

    const refreshedBooking = await require('./modules/banquet/models/EventBooking').findById(booking2._id);
    assert(refreshedBooking.status === 'cancelled', `expected booking status "cancelled", got "${refreshedBooking.status}"`);
  });

  // --- 18. Service Station industry module: mileage-based (usage-based, not calendar-based) service-due detection ---
  await step('Enable the service_station module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'service_station' } });
  });

  const vehicle = await step('Register a vehicle with a 5,000-unit service interval, serviced at 10,000', async () => {
    const v = await vehicleService.registerVehicle({
      companyId: company._id, customerId: customer._id, make: 'Toyota', model: 'Corolla', year: 2020,
      registrationNumber: `SMOKE-${suffix}`, currentMileage: 10000, serviceIntervalMileage: 5000, serviceIntervalMonths: 6,
    });
    assert(v.nextServiceDueMileage === null, 'a freshly registered vehicle with no service history has no "next due" yet — nothing to be due FROM');
    return v;
  });

  await step('Recording a completed service sets next-due to exactly mileage + interval — hand-traced: 10000 + 5000 = 15000', async () => {
    const updated = await vehicleService.recordServiceCompleted(vehicle._id, { mileageAtService: 10000, serviceDate: new Date() });
    assert(updated.nextServiceDueMileage === 15000, `expected nextServiceDueMileage 15000 (10000 + 5000), got ${updated.nextServiceDueMileage}`);
    assert(updated.lastServiceMileage === 10000, `expected lastServiceMileage 10000, got ${updated.lastServiceMileage}`);
  });

  await step('Not due yet at 14,999 miles — excluded from listServiceDue', async () => {
    await vehicleService.updateMileage(vehicle._id, 14999);
    const due = await vehicleService.listServiceDue(company._id);
    assert(!due.some((v) => String(v._id) === String(vehicle._id)), 'a vehicle 1 mile under its threshold must not appear as due');
  });

  await step('Due exactly at 15,000 miles (the threshold itself counts) — appears in listServiceDue via a real Mongo $expr query, not a JS loop', async () => {
    await vehicleService.updateMileage(vehicle._id, 15000);
    const due = await vehicleService.listServiceDue(company._id);
    assert(due.some((v) => String(v._id) === String(vehicle._id)), 'a vehicle exactly at its mileage threshold must appear as due (>=, not >)');
  });

  await step('Odometer cannot go backward — a lower mileage reading is rejected as a likely data-entry mistake', async () => {
    let threw = false;
    try {
      await vehicleService.updateMileage(vehicle._id, 12000); // below the already-recorded 15000
    } catch { threw = true; }
    assert(threw, 'expected a mileage reading lower than the current recorded value to be rejected');
  });

  await step('Recording a new completed service resets the clock — vehicle drops out of listServiceDue again', async () => {
    await vehicleService.recordServiceCompleted(vehicle._id, { mileageAtService: 15000, serviceDate: new Date() });
    const due = await vehicleService.listServiceDue(company._id);
    assert(!due.some((v) => String(v._id) === String(vehicle._id)), 'after a fresh service, the vehicle should no longer be due');
  });

  await step('A job card opened against this vehicle is tagged with vehicleId and shows up in its service history — reuses core ServiceOrder unmodified', async () => {
    const jobCard = await vehicleService.openJobCard({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, vehicleId: vehicle._id,
      itemDescription: 'Oil change', userId: null,
    });
    assert(String(jobCard.vehicleId) === String(vehicle._id), 'job card correctly tagged with vehicleId');

    const history = await vehicleService.serviceHistory(vehicle._id);
    assert(history.some((h) => String(h._id) === String(jobCard._id)), 'the job card appears in this vehicle\'s service history');
  });

  // --- 19. Auto Parts industry module: vehicle fitment/compatibility lookup, both directions, exact range-boundary math ---
  await step('Enable the auto_parts module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'auto_parts' } });
  });

  const brakeProduct = await step('Create a brake pad product and register it as fitting 2015-2020 Toyota Corolla', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Front Brake Pads', sku: `BRK-${suffix}`,
      trackingMode: 'simple', costPrice: 800, sellingPrice: 1500,
      variants: [{ sku: `BRK-${suffix}`, sellingPrice: 1500 }],
    });
    await fitmentService.addFitment({ companyId: company._id, productId: p._id, make: 'Toyota', model: 'Corolla', yearFrom: 2015, yearTo: 2020 });
    return p;
  });

  await step('A 2014 Corolla (one year before the range) finds nothing — the lower boundary excludes correctly', async () => {
    const results = await fitmentService.findPartsForVehicle(company._id, { make: 'Toyota', model: 'Corolla', year: 2014 });
    assert(!results.some((r) => String(r.productId) === String(brakeProduct._id)), 'a year just outside the range must not match');
  });

  await step('A 2015 Corolla (exactly the lower boundary) DOES find it — inclusive range, not exclusive', async () => {
    const results = await fitmentService.findPartsForVehicle(company._id, { make: 'Toyota', model: 'Corolla', year: 2015 });
    assert(results.some((r) => String(r.productId) === String(brakeProduct._id)), 'the exact lower boundary year must match (inclusive)');
  });

  await step('A 2020 Corolla (exactly the upper boundary) DOES find it too', async () => {
    const results = await fitmentService.findPartsForVehicle(company._id, { make: 'Toyota', model: 'Corolla', year: 2020 });
    assert(results.some((r) => String(r.productId) === String(brakeProduct._id)), 'the exact upper boundary year must match (inclusive)');
  });

  await step('A 2021 Corolla (one year past the range) finds nothing — the upper boundary excludes correctly', async () => {
    const results = await fitmentService.findPartsForVehicle(company._id, { make: 'Toyota', model: 'Corolla', year: 2021 });
    assert(!results.some((r) => String(r.productId) === String(brakeProduct._id)), 'a year just past the range must not match');
  });

  await step('A matching year but a DIFFERENT model correctly finds nothing — make/model filters aren\'t ignored', async () => {
    const results = await fitmentService.findPartsForVehicle(company._id, { make: 'Toyota', model: 'Camry', year: 2018 });
    assert(!results.some((r) => String(r.productId) === String(brakeProduct._id)), 'a matching year for a different model must not match');
  });

  await step('The reverse lookup — "what does this part fit" — returns the same fitment record from the product\'s side', async () => {
    const fitments = await fitmentService.listFitmentsForProduct(company._id, brakeProduct._id);
    assert(fitments.length === 1 && fitments[0].make === 'Toyota' && fitments[0].model === 'Corolla', 'reverse lookup returns the exact fitment just created');
  });

  // --- 20. Hospital industry module: OPD check-in queue, strict FIFO ordering (not just "any waiting patient") ---
  await step('Enable the hospital module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'hospital' } });
  });

  const consultProduct = await step('Create the consultation billing product — trackingMode "service"', () =>
    Product.create({
      companyId: company._id, name: 'Consultation', sku: `CONSULT-${suffix}`,
      trackingMode: 'service', costPrice: 0, sellingPrice: 0,
      variants: [{ sku: `CONSULT-${suffix}`, sellingPrice: 0 }],
    })
  );

  const [visitA, visitB, visitC] = await step('Check in 3 patients in order — queue numbers must be sequential (1, 2, 3), not arbitrary', async () => {
    const a = await hospitalService.checkIn({ companyId: company._id, branchId: branch._id, customerId: customer._id, chiefComplaint: 'Fever', consultationFee: 2000, billingProductId: consultProduct._id, billingVariantId: consultProduct.variants[0]._id });
    const b = await hospitalService.checkIn({ companyId: company._id, branchId: branch._id, customerId: customer._id, chiefComplaint: 'Headache', consultationFee: 2000, billingProductId: consultProduct._id, billingVariantId: consultProduct.variants[0]._id });
    const c = await hospitalService.checkIn({ companyId: company._id, branchId: branch._id, customerId: customer._id, chiefComplaint: 'Cough', consultationFee: 2000, billingProductId: consultProduct._id, billingVariantId: consultProduct.variants[0]._id });
    assert(a.queueNumber === 1 && b.queueNumber === 2 && c.queueNumber === 3, `expected queue numbers 1,2,3 in check-in order, got ${a.queueNumber},${b.queueNumber},${c.queueNumber}`);
    return [a, b, c];
  });

  await step('The waiting queue lists all 3 in check-in order', async () => {
    const queue = await hospitalService.currentQueue(branch._id);
    assert(queue.length === 3, `expected 3 patients waiting, got ${queue.length}`);
    assert(queue[0].queueNumber === 1 && queue[2].queueNumber === 3, 'queue is ordered by queueNumber ascending, first-in first');
  });

  await step('callNext pulls the FIRST patient checked in (A), not the last one added (C)', async () => {
    const called = await hospitalService.callNext(branch._id, null);
    assert(String(called._id) === String(visitA._id), `expected callNext to pull visit A (queueNumber 1), got queueNumber ${called.queueNumber}`);
    assert(called.status === 'in_consultation', `expected status "in_consultation", got "${called.status}"`);
  });

  await step('Complete visit A — bills the consultation fee through the ordinary checkout', async () => {
    const result = await hospitalService.completeVisit(visitA._id, { warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null });
    assert(result.sale.totalAmount === 2000, `expected consultation sale total 2000, got ${result.sale.totalAmount}`);
    assert(result.visit.status === 'completed', `expected visit status "completed", got "${result.visit.status}"`);
  });

  await step('callNext again pulls B, NOT C — proves strict FIFO order survives A being removed from the queue, not "any remaining waiting visit"', async () => {
    const called = await hospitalService.callNext(branch._id, null);
    assert(String(called._id) === String(visitB._id), `expected callNext to pull visit B (queueNumber 2) next, not C — got queueNumber ${called.queueNumber}`);
  });

  await step('With no one waiting, callNext throws a clear error rather than returning something wrong', async () => {
    await hospitalService.cancelVisit(visitC._id); // the only remaining waiting visit — remove it so the queue is genuinely empty
    let threw = false;
    try {
      await hospitalService.callNext(branch._id, null);
    } catch { threw = true; }
    assert(threw, 'expected callNext to throw when no patients are waiting');
  });

  // --- 21. Gym industry module: capacity-constrained shared booking with automatic FIFO waitlist promotion ---
  await step('Enable the gym module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'gym' } });
  });

  const gymClass = await step('Create a class with capacity 2', () =>
    gymService.createClass({ companyId: company._id, branchId: branch._id, name: 'Morning Yoga', capacity: 2 })
  );
  const gymSession = await step('Schedule a session — capacity is snapshotted from the class', () =>
    gymService.scheduleSession(gymClass._id, new Date(Date.now() + 24 * 60 * 60 * 1000))
  );
  assert(gymSession.capacity === 2, `expected session capacity snapshotted as 2, got ${gymSession.capacity}`);

  const [memberA, memberB, memberC] = await step('Create 3 distinct members to enroll', () =>
    Promise.all([
      Customer.create({ companyId: company._id, name: 'Member A' }),
      Customer.create({ companyId: company._id, name: 'Member B' }),
      Customer.create({ companyId: company._id, name: 'Member C' }),
    ])
  );

  await step('First two enrollments fill the 2 seats exactly — both get a real seat, not waitlisted', async () => {
    const rA = await gymService.enroll(gymSession._id, memberA._id);
    const rB = await gymService.enroll(gymSession._id, memberB._id);
    assert(rA.enrolled === true && !rA.waitlisted, 'member A should get a real seat (1st of 2)');
    assert(rB.enrolled === true && !rB.waitlisted, 'member B should get a real seat (2nd of 2, fills capacity exactly)');
  });

  await step('The 3rd enrollment, past capacity, goes to the waitlist at position 1, not a seat', async () => {
    const rC = await gymService.enroll(gymSession._id, memberC._id);
    assert(rC.enrolled === false && rC.waitlisted === true, 'member C should be waitlisted, not seated — capacity is already full');
    assert(rC.waitlistPosition === 1, `expected waitlist position 1, got ${rC.waitlistPosition}`);
  });

  await step('Cancelling A\'s seat automatically promotes C (the only waitlisted member) into it', async () => {
    const result = await gymService.cancelEnrollment(gymSession._id, memberA._id);
    assert(String(result.promotedCustomerId) === String(memberC._id), `expected member C to be promoted, got ${result.promotedCustomerId}`);

    const roster = await gymService.sessionRoster(gymSession._id);
    const enrolledIds = roster.enrolledCustomerIds.map((c) => String(c._id));
    assert(enrolledIds.includes(String(memberB._id)) && enrolledIds.includes(String(memberC._id)) && !enrolledIds.includes(String(memberA._id)),
      'roster after promotion should be exactly [B, C] — A removed, C moved from waitlist to enrolled, B untouched');
    assert(roster.waitlistCustomerIds.length === 0, 'waitlist should be empty after its only member was promoted');
  });

  await step('Re-enrolling A now goes to the waitlist again — the session is back to full (B + C), not stale from before the cancellation', async () => {
    const result = await gymService.enroll(gymSession._id, memberA._id);
    assert(result.waitlisted === true, 'member A re-enrolling into a now-full session (B, C) should be waitlisted, not seated');
  });

  // --- 22. Electronics industry module: serial-tied warranty eligibility + a claim escalating into a real core repair job ---
  await step('Enable the electronics module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'electronics' } });
  });

  const phoneProduct2 = await step('Create a serial-tracked product, receive and sell TWO fresh serials to get real "sold" statuses for both the active and expired warranty cases', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Smoke Phone 2', sku: `PH2-${suffix}`,
      trackingMode: 'serial', costPrice: 500, sellingPrice: 900,
      variants: [{ sku: `PH2-${suffix}`, sellingPrice: 900 }],
    });
    const phonePo2 = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      items: [{ productId: p._id, variantId: p.variants[0]._id, quantityOrdered: 2, unitCost: 500 }], userId: null,
    });
    await purchaseService.decidePurchaseOrder(phonePo2._id, { approve: true, userId: null });
    await purchaseService.receiveGoods({
      purchaseOrderId: phonePo2._id, warehouseId: warehouse._id,
      items: [{
        purchaseOrderItemId: phonePo2.items[0]._id, productId: p._id, variantId: p.variants[0]._id,
        quantity: 2, unitCost: 500, serialNumbers: [`WARR-${suffix}`, `WARR-EXPIRED-${suffix}`],
      }],
      userId: null,
    });
    await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: p._id, variantId: p.variants[0]._id, quantity: 2, unitPrice: 900, serialNumbers: [`WARR-${suffix}`, `WARR-EXPIRED-${suffix}`] }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 1800 }],
    });
    return p;
  });

  const activeWarranty = await warrantyService.registerWarranty({
    companyId: company._id, serialNumber: `WARR-${suffix}`, warrantyMonths: 12, startDate: new Date(), customerId: customer._id,
  });

  await step('A warranty registered today with a 12-month term is clearly under warranty right now', async () => {
    const result = await warrantyService.checkWarranty(company._id, `WARR-${suffix}`);
    assert(result.found === true && result.underWarranty === true, `expected an active warranty, got underWarranty=${result.underWarranty}`);
    assert(result.daysRemaining > 300, `expected roughly a year (300+ days) remaining on a fresh 12-month warranty, got ${result.daysRemaining}`);
  });

  const expiredWarranty = await warrantyService.registerWarranty({
    companyId: company._id, serialNumber: `WARR-EXPIRED-${suffix}`, warrantyMonths: 12,
    startDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000), // registered 3 years ago — a real, valid registration, just with an intentionally old startDate so its 12-month term has long since lapsed
  });

  await step('A warranty from 3 years ago with a 12-month term is clearly expired', async () => {
    const result = await warrantyService.checkWarranty(company._id, `WARR-EXPIRED-${suffix}`);
    assert(result.found === true && result.underWarranty === false, `expected an expired warranty, got underWarranty=${result.underWarranty}`);
    assert(result.daysExpired > 300, `expected the warranty to have been expired for roughly 2 years (700+ days), got ${result.daysExpired} — actually asserting >300 to stay robust regardless of exact run date`);
  });

  await step('Submitting a claim against the expired warranty is rejected outright, not silently accepted', async () => {
    let threw = false;
    try {
      await warrantyService.submitClaim(expiredWarranty._id, { issueDescription: 'Screen cracked', userId: null });
    } catch { threw = true; }
    assert(threw, 'expected a claim against an expired warranty to be rejected at submission time');
  });

  const claim = await step('Submitting a claim against the ACTIVE warranty succeeds', () =>
    warrantyService.submitClaim(activeWarranty._id, { issueDescription: 'Battery drains fast', userId: null })
  );
  assert(claim.status === 'submitted', `expected claim status "submitted", got "${claim.status}"`);

  await step('Approving the claim, then opening a repair job, creates a REAL core ServiceOrder — not a duplicate concept', async () => {
    await warrantyService.decideClaim(claim._id, { approve: true, decisionNote: 'Covered under warranty' });
    const withRepair = await warrantyService.linkRepairJob(claim._id, {
      branchId: branch._id, warehouseId: warehouse._id, itemDescription: 'Battery replacement', userId: null,
    });
    assert(withRepair.status === 'in_repair', `expected claim status "in_repair", got "${withRepair.status}"`);
    assert(withRepair.serviceOrderId, 'expected the claim to be linked to a real ServiceOrder');

    const ServiceOrder = require('./models/ServiceOrder');
    const jobCard = await ServiceOrder.findById(withRepair.serviceOrderId);
    assert(jobCard && jobCard.itemDescription === 'Battery replacement', 'the linked document is a real core ServiceOrder job card, findable through the actual core model');

    const resolved = await warrantyService.resolveClaim(claim._id);
    assert(resolved.status === 'resolved', `expected final claim status "resolved", got "${resolved.status}"`);
  });

  // --- 23. Furniture industry module: deposit interlink + REAL core Manufacturing production + on-time delivery SLA metric ---
  await step('Enable the furniture module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'furniture' } });
  });

  const customTable = await step('Create the finished-goods product and a real BOM using the existing raw-material product', async () => {
    const table = await Product.create({
      companyId: company._id, name: 'Custom Dining Table', sku: `TBL-${suffix}`,
      trackingMode: 'simple', costPrice: 0, sellingPrice: 0,
      variants: [{ sku: `TBL-${suffix}`, sellingPrice: 0 }],
    });
    return table;
  });
  const furnitureBom = await manufacturingService.createBOM({
    companyId: company._id, finishedProductId: customTable._id, finishedVariantId: customTable.variants[0]._id,
    name: 'Dining Table BOM', components: [{ productId: product._id, variantId, quantityPerUnit: 5 }],
    laborCostPerUnit: 1000, overheadCostPerUnit: 200,
  });

  const furnitureDepositLiability = await Account.create({ companyId: company._id, name: 'Custom Order Deposits', type: 'liability' });

  async function runFullCustomOrder(promisedDeliveryDate) {
    const order = await furnitureService.placeOrder({
      companyId: company._id, branchId: branch._id, customerId: customer._id,
      description: 'Custom oak dining table', promisedDeliveryDate, price: 15000,
      depositAmount: 5000, depositReceivedInAccountId: cash._id, depositLiabilityAccountId: furnitureDepositLiability._id, userId: null,
    });
    const withWorkOrder = await furnitureService.startProduction(order._id, { bomId: furnitureBom._id, warehouseId: warehouse._id, userId: null });
    // The furniture module only CREATES the work order — actually running
    // production is the real, unmodified core Manufacturing flow, called
    // directly here exactly as any other caller of that module would.
    await manufacturingService.startProduction(withWorkOrder.workOrderId, null);
    await manufacturingService.completeProduction(withWorkOrder.workOrderId, { quantityProduced: 1, actualLaborCost: 1000, actualOverheadCost: 200, userId: null });
    await furnitureService.markReady(order._id);
    return furnitureService.deliver(order._id, { warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: null });
  }

  await step('An order promised 7 days from now, delivered today, bills correctly and counts as ON TIME — hand-traced: 15000 price - 5000 deposit = 10000 remaining', async () => {
    const result = await runFullCustomOrder(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    assert(result.sale.totalAmount === 15000, `expected sale total 15000, got ${result.sale.totalAmount}`);
    assert(result.wasOnTime === true, 'delivering well before the promised date must count as on time');

    const tableStock = await inventoryService.getStockLevel(warehouse._id, customTable.variants[0]._id);
    assert(tableStock === 0, `expected the finished table's stock to be exactly 0 after production (1) minus delivery sale (1) — got ${tableStock}, confirming real core Manufacturing AND real core checkout both actually ran, not stubs`);
  });

  await step('An order promised YESTERDAY, delivered today, correctly counts as LATE', async () => {
    const result = await runFullCustomOrder(new Date(Date.now() - 24 * 60 * 60 * 1000));
    assert(result.wasOnTime === false, 'delivering after the promised date must count as late, not on time');
  });

  await step('On-time delivery rate across both orders is exactly 50% (1 on-time, 1 late) — a real aggregate, not per-order', async () => {
    const rate = await furnitureService.onTimeDeliveryRate(company._id);
    assert(rate.totalDelivered === 2, `expected 2 total delivered orders, got ${rate.totalDelivered}`);
    assert(rate.onTimeCount === 1 && rate.lateCount === 1, `expected exactly 1 on-time and 1 late, got onTime=${rate.onTimeCount} late=${rate.lateCount}`);
    assert(rate.onTimeRate === 50, `expected exactly 50% on-time rate (1 of 2), got ${rate.onTimeRate}`);
  });

  // --- 24. Fashion industry module: automatic time-decay markdown pricing — a price that changes with NO action from anyone ---
  await step('Enable the fashion module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'fashion' } });
  });

  const jacketProduct = await step('Create a product with base price 1000 and a 3-stage markdown schedule (0%, 20% at 30 days, 50% at 60 days)', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Denim Jacket', sku: `JKT-${suffix}`,
      trackingMode: 'simple', costPrice: 400, sellingPrice: 1000,
      variants: [{ sku: `JKT-${suffix}`, sellingPrice: 1000 }],
    });
    await markdownService.setSchedule({
      companyId: company._id, productId: p._id, variantId: p.variants[0]._id,
      launchDate: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000), // 29 days ago — 1 day short of the first markdown
      stages: [{ daysSinceLaunch: 0, discountPercent: 0 }, { daysSinceLaunch: 30, discountPercent: 20 }, { daysSinceLaunch: 60, discountPercent: 50 }],
    });
    return p;
  });
  const jacketVariantId = jacketProduct.variants[0]._id;

  await step('At 29 days elapsed (1 short of the 30-day stage), price is still full — hand-traced: 1000 × (1-0%) = 1000', async () => {
    const result = await markdownService.currentPrice(company._id, jacketVariantId);
    assert(result.discountPercent === 0, `expected 0% discount at 29 days (1-day short of the 30-day stage), got ${result.discountPercent}%`);
    assert(result.currentPrice === 1000, `expected currentPrice 1000 (no discount yet), got ${result.currentPrice}`);
  });

  await step('Re-launching exactly 30 days ago crosses into the first markdown stage — the boundary itself counts (>=, not >)', async () => {
    await markdownService.setSchedule({
      companyId: company._id, productId: jacketProduct._id, variantId: jacketVariantId,
      launchDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      stages: [{ daysSinceLaunch: 0, discountPercent: 0 }, { daysSinceLaunch: 30, discountPercent: 20 }, { daysSinceLaunch: 60, discountPercent: 50 }],
    });
    const result = await markdownService.currentPrice(company._id, jacketVariantId);
    assert(result.discountPercent === 20, `expected the 20% stage to apply at exactly 30 days elapsed, got ${result.discountPercent}%`);
    assert(result.currentPrice === 800, `expected currentPrice 800 (1000 × 0.8), got ${result.currentPrice}`);
  });

  await step('Re-launching exactly 60 days ago crosses into the deepest markdown stage, not the 30-day one — hand-traced: 1000 × 0.5 = 500', async () => {
    await markdownService.setSchedule({
      companyId: company._id, productId: jacketProduct._id, variantId: jacketVariantId,
      launchDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      stages: [{ daysSinceLaunch: 0, discountPercent: 0 }, { daysSinceLaunch: 30, discountPercent: 20 }, { daysSinceLaunch: 60, discountPercent: 50 }],
    });
    const result = await markdownService.currentPrice(company._id, jacketVariantId);
    assert(result.discountPercent === 50 && result.stageApplied === 60, `expected the deepest (60-day, 50%) stage — the highest threshold met, not an earlier one — got stage ${result.stageApplied} at ${result.discountPercent}%`);
    assert(result.currentPrice === 500, `expected currentPrice 500 (1000 × 0.5), got ${result.currentPrice}`);
  });

  await step('A schedule\'s first stage must start at day 0 — rejected outright if it doesn\'t, since there\'d be an undefined price for the gap before the first stage', async () => {
    let threw = false;
    try {
      await markdownService.setSchedule({
        companyId: company._id, productId: jacketProduct._id, variantId: jacketVariantId,
        stages: [{ daysSinceLaunch: 10, discountPercent: 10 }], // doesn't start at 0
      });
    } catch { threw = true; }
    assert(threw, 'expected a schedule whose first stage doesn\'t start at daysSinceLaunch 0 to be rejected');
  });

  // --- 25. Bakery/Cafe industry module: same-day production + automatic end-of-day waste write-off (an ACTION, not just a report) ---
  await step('Enable the bakery module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'bakery' } });
  });

  const croissantProduct = await step('Create a fresh perishable product with zero prior stock', () =>
    Product.create({
      companyId: company._id, name: 'Croissant', sku: `CRO-${suffix}`,
      trackingMode: 'simple', costPrice: 20, sellingPrice: 60,
      variants: [{ sku: `CRO-${suffix}`, sellingPrice: 60 }],
    })
  );
  const croissantVariantId = croissantProduct.variants[0]._id;

  const morningBatch = await step('Produce 50 croissants this morning at 20/unit cost — stock should be exactly 50', async () => {
    const batch = await dailyBatchService.produceBatch({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      productId: croissantProduct._id, variantId: croissantVariantId, producedQuantity: 50, unitCost: 20, userId: null,
    });
    const stock = await inventoryService.getStockLevel(warehouse._id, croissantVariantId);
    assert(stock === 50, `expected stock 50 right after production, got ${stock}`);
    return batch;
  });

  await step('Sell 30 through the day via the ordinary checkout — stock drops to exactly 20', async () => {
    await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: croissantProduct._id, variantId: croissantVariantId, quantity: 30, unitPrice: 60 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 1800 }],
    });
    const stock = await inventoryService.getStockLevel(warehouse._id, croissantVariantId);
    assert(stock === 20, `expected stock 20 after selling 30 of the 50 produced, got ${stock}`);
  });

  await step('Closing the batch writes off exactly the 20 unsold units and posts a real waste voucher — hand-traced: 20 × 20 = 400', async () => {
    const closed = await dailyBatchService.closeBatch(morningBatch._id, { userId: null });
    assert(closed.status === 'closed', `expected batch status "closed", got "${closed.status}"`);
    assert(closed.wastedQuantity === 20, `expected exactly 20 units written off (the unsold remainder, capped at what was actually produced), got ${closed.wastedQuantity}`);
    assert(closed.wasteValue === 400, `expected waste value 400 (20 × 20 unit cost), got ${closed.wasteValue}`);

    const stockAfterClose = await inventoryService.getStockLevel(warehouse._id, croissantVariantId);
    assert(stockAfterClose === 0, `expected stock exactly 0 after the write-off removed the remaining 20, got ${stockAfterClose}`);

    // Same rigor as the Banquet cancellation voucher — pull the ACTUAL
    // posted voucher back out and check its real entries, not just trust
    // the function's own return value describes what it did.
    const Voucher = require('./models/Voucher');
    const voucher = await Voucher.findById(closed.voucherId);
    assert(voucher, 'expected a real voucher to have been posted for the waste write-off');
    const totalDebit = voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 400 && totalCredit === 400, `expected the waste voucher to debit and credit exactly 400 each, got debit=${totalDebit} credit=${totalCredit}`);
  });

  await step('Closing an already-closed batch is rejected, not silently re-processed', async () => {
    let threw = false;
    try {
      await dailyBatchService.closeBatch(morningBatch._id, { userId: null });
    } catch { threw = true; }
    assert(threw, 'expected closing an already-closed batch to be rejected');
  });

  // --- 26. CRM campaign sending — closing a real gap, not adding a module: this used to do nothing beyond marking a campaign "sent" ---
  await step('A campaign sent to a customer with NO phone on file fails cleanly for that recipient, not silently or with a crash', async () => {
    await Customer.findByIdAndUpdate(customer._id, { $addToSet: { tags: 'SmokeSegment' } });
    const campaign = await crmService.createCampaign({
      companyId: company._id, name: 'Smoke SMS Campaign', channel: 'sms', message: 'Hello from the smoke test',
      targetTags: ['SmokeSegment'], userId: null,
    });
    const { campaign: sent, results } = await crmService.sendCampaign(campaign._id);

    assert(sent.status === 'sent', `expected campaign status "sent", got "${sent.status}"`);
    assert(sent.recipientCount === 1, `expected exactly 1 recipient (the customer tagged SmokeSegment), got ${sent.recipientCount}`);
    assert(sent.failureCount === 1 && sent.successCount === 0, `expected this send to fail for its one recipient (no phone on file), got success=${sent.successCount} failure=${sent.failureCount}`);
    assert(sent.provider === 'console', `expected the fallback console provider to be used (no Twilio credentials configured in this environment), got "${sent.provider}"`);
    assert(results[0].error.includes('No phone number'), `expected a specific, honest error message about the missing phone number, got "${results[0].error}"`);
  });

  await step('A campaign sent to a customer WITH a phone on file succeeds through the real console provider', async () => {
    await Customer.findByIdAndUpdate(customer._id, { phone: '+15551234567' });
    const campaign = await crmService.createCampaign({
      companyId: company._id, name: 'Smoke SMS Campaign 2', channel: 'sms', message: 'Second smoke test message',
      targetTags: ['SmokeSegment'], userId: null,
    });
    const { campaign: sent } = await crmService.sendCampaign(campaign._id);

    assert(sent.successCount === 1 && sent.failureCount === 0, `expected 1 success and 0 failures now that the customer has a phone on file, got success=${sent.successCount} failure=${sent.failureCount}`);
  });

  await step('Re-sending an already-sent campaign is rejected, not silently re-processed into a duplicate send', async () => {
    const campaign = await crmService.createCampaign({
      companyId: company._id, name: 'Smoke SMS Campaign 3', channel: 'sms', message: 'Third', targetTags: ['SmokeSegment'], userId: null,
    });
    await crmService.sendCampaign(campaign._id);
    let threw = false;
    try {
      await crmService.sendCampaign(campaign._id);
    } catch { threw = true; }
    assert(threw, 'expected re-sending an already-sent campaign to be rejected');
  });

  // --- 27. Grocery industry module: FEFO multi-batch pick allocation — the first genuinely multi-record greedy algorithm in this app ---
  await step('Enable the grocery module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'grocery' } });
  });

  const milkProduct = await step('Create a batch-tracked product with zero stock to start', () =>
    Product.create({
      companyId: company._id, name: 'Milk Carton', sku: `MILK-${suffix}`,
      trackingMode: 'batch', costPrice: 100, sellingPrice: 150,
      variants: [{ sku: `MILK-${suffix}`, sellingPrice: 150 }],
    })
  );
  const milkVariantId = milkProduct.variants[0]._id;

  await step('Receive 3 separate batches with different expiry dates and quantities — 10 expiring soonest, 15 next, 20 last', async () => {
    const milkPo = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      items: [{ productId: milkProduct._id, variantId: milkVariantId, quantityOrdered: 45, unitCost: 100 }], userId: null,
    });
    await purchaseService.decidePurchaseOrder(milkPo._id, { approve: true, userId: null });

    // Received in a deliberately SCRAMBLED order (soonest-expiring batch
    // received SECOND, not first) — specifically to prove FEFO sorts by
    // actual expiry date, not by receiving order or batch-creation order.
    await purchaseService.receiveGoods({
      purchaseOrderId: milkPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: milkPo.items[0]._id, productId: milkProduct._id, variantId: milkVariantId, quantity: 15, unitCost: 100, batchNumber: 'MILK-B', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) }],
      userId: null,
    });
    await purchaseService.receiveGoods({
      purchaseOrderId: milkPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: milkPo.items[0]._id, productId: milkProduct._id, variantId: milkVariantId, quantity: 10, unitCost: 100, batchNumber: 'MILK-A', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }],
      userId: null,
    });
    await purchaseService.receiveGoods({
      purchaseOrderId: milkPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: milkPo.items[0]._id, productId: milkProduct._id, variantId: milkVariantId, quantity: 20, unitCost: 100, batchNumber: 'MILK-C', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000) }],
      userId: null,
    });
  });

  await step('Requesting 20 units correctly takes ALL 10 from the soonest-expiring batch, then spills into the next batch for the remaining 10 — never touching the third', async () => {
    const result = await fefoService.suggestPickOrder(warehouse._id, milkVariantId, 20);
    assert(result.fullyCovered === true && result.shortfall === 0, `expected the request to be fully covered, got fullyCovered=${result.fullyCovered} shortfall=${result.shortfall}`);
    assert(result.allocations.length === 2, `expected exactly 2 batches used (not 1, not 3), got ${result.allocations.length}`);
    assert(result.allocations[0].batchNumber === 'MILK-A' && result.allocations[0].quantity === 10, `expected the FIRST allocation to be the soonest-expiring batch MILK-A for its full 10 units, got ${JSON.stringify(result.allocations[0])}`);
    assert(result.allocations[1].batchNumber === 'MILK-B' && result.allocations[1].quantity === 10, `expected the SECOND allocation to spill into MILK-B (next-soonest) for exactly the remaining 10, got ${JSON.stringify(result.allocations[1])}`);
    assert(result.totalAllocated === 20, `expected totalAllocated 20, got ${result.totalAllocated}`);
  });

  await step('Requesting more than total available (45) across all 3 batches correctly reports a real shortfall, not a false "covered"', async () => {
    const result = await fefoService.suggestPickOrder(warehouse._id, milkVariantId, 50);
    assert(result.fullyCovered === false, 'expected fullyCovered false when requesting more than the 45 total units in stock');
    assert(result.shortfall === 5, `expected a shortfall of exactly 5 (50 requested - 45 available), got ${result.shortfall}`);
    assert(result.allocations.length === 3, `expected all 3 batches to be used (everything available gets allocated even though it's not enough), got ${result.allocations.length}`);
    assert(result.totalAllocated === 45, `expected totalAllocated to be everything actually in stock (45), got ${result.totalAllocated}`);
  });

  // --- 28. Footwear industry module: size-curve proportional apportionment — largest-remainder method, guaranteed to sum exactly ---
  await step('Enable the footwear module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'footwear' } });
  });

  const shoeProduct = await step('Create a shoe product with 4 size variants', () =>
    Product.create({
      companyId: company._id, name: 'Running Shoe', sku: `SHOE-${suffix}`,
      trackingMode: 'variant', costPrice: 2000, sellingPrice: 4000,
      variants: [
        { sku: `SHOE-${suffix}-7`, sellingPrice: 4000, attributeValues: { Size: '7' } },
        { sku: `SHOE-${suffix}-8`, sellingPrice: 4000, attributeValues: { Size: '8' } },
        { sku: `SHOE-${suffix}-9`, sellingPrice: 4000, attributeValues: { Size: '9' } },
        { sku: `SHOE-${suffix}-10`, sellingPrice: 4000, attributeValues: { Size: '10' } },
      ],
    })
  );

  const curve = await sizeCurveService.createCurve({
    companyId: company._id, name: 'Standard Curve',
    ratios: [{ sizeLabel: '7', percent: 20 }, { sizeLabel: '8', percent: 35 }, { sizeLabel: '9', percent: 30 }, { sizeLabel: '10', percent: 15 }],
  });

  await step('Applying the curve to 47 units lands on EXACTLY the hand-computed split (9/17/14/7) — naive Math.round on the same inputs would sum to only 46, one short', async () => {
    const allocation = await sizeCurveService.applyCurve(curve._id, shoeProduct._id, 47);
    const bySize = Object.fromEntries(allocation.map((a) => [a.sizeLabel, a.quantity]));

    assert(bySize['7'] === 9, `expected size 7 to get 9 (floor of 9.4, no remainder bump — its 0.4 remainder wasn't the largest), got ${bySize['7']}`);
    assert(bySize['8'] === 17, `expected size 8 to get 17 (floor of 16.45 PLUS 1, since its 0.45 remainder was the largest), got ${bySize['8']}`);
    assert(bySize['9'] === 14, `expected size 9 to get 14 (floor of 14.1, no bump), got ${bySize['9']}`);
    assert(bySize['10'] === 7, `expected size 10 to get 7 (floor of 7.05, no bump), got ${bySize['10']}`);

    const total = allocation.reduce((sum, a) => sum + a.quantity, 0);
    assert(total === 47, `expected the 4 quantities to sum to EXACTLY 47 (the whole point of the largest-remainder method over naive rounding), got ${total}`);
  });

  await step('A tied remainder (50/50 split, odd total) breaks the tie deterministically by declaration order, not randomly', async () => {
    const tiedCurve = await sizeCurveService.createCurve({
      companyId: company._id, name: 'Tied 50/50 Curve',
      ratios: [{ sizeLabel: '7', percent: 50 }, { sizeLabel: '8', percent: 50 }],
    });
    const allocation = await sizeCurveService.applyCurve(tiedCurve._id, shoeProduct._id, 1);
    const bySize = Object.fromEntries(allocation.map((a) => [a.sizeLabel, a.quantity]));
    assert(bySize['7'] === 1 && bySize['8'] === 0, `expected the tie between two identical 0.5 remainders to be broken in favor of the FIRST-declared ratio (size 7), got 7=${bySize['7']} 8=${bySize['8']}`);
  });

  await step('A curve whose percentages don\'t sum to 100 is rejected outright, not silently accepted', async () => {
    let threw = false;
    try {
      await sizeCurveService.createCurve({
        companyId: company._id, name: 'Broken Curve',
        ratios: [{ sizeLabel: '7', percent: 50 }, { sizeLabel: '8', percent: 40 }], // sums to 90, not 100
      });
    } catch { threw = true; }
    assert(threw, 'expected a curve with ratios summing to 90 (not 100) to be rejected');
  });

  // --- 29. Textile industry module: continuous roll depletion with automatic remnant/exhausted status transition ---
  await step('Enable the textile module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'textile' } });
  });

  const fabricProduct = await step('Create a fabric product with zero prior stock', () =>
    Product.create({
      companyId: company._id, name: 'Cotton Fabric', sku: `FAB-${suffix}`,
      trackingMode: 'simple', costPrice: 200, sellingPrice: 350,
      variants: [{ sku: `FAB-${suffix}`, sellingPrice: 350 }],
    })
  );
  const fabricVariantId = fabricProduct.variants[0]._id;

  const roll = await step('Receive a 20-meter roll with a 5-meter remnant threshold — stock should be exactly 20', async () => {
    const r = await fabricRollService.receiveRoll({
      companyId: company._id, productId: fabricProduct._id, variantId: fabricVariantId, warehouseId: warehouse._id,
      rollNumber: `ROLL-${suffix}`, unitOfMeasure: 'meters', length: 20, unitCost: 200, remnantThreshold: 5, userId: null,
    });
    const stock = await inventoryService.getStockLevel(warehouse._id, fabricVariantId);
    assert(stock === 20, `expected stock 20 right after receiving the roll, got ${stock}`);
    assert(r.status === 'active', `expected a freshly received roll to start "active", got "${r.status}"`);
    return r;
  });

  await step('Cutting 10m leaves 10m remaining — still above the 5m threshold, status stays "active", nobody had to mark it', async () => {
    const cut = await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 10, userId: null });
    assert(cut.remainingLength === 10, `expected remainingLength 10 (20 - 10), got ${cut.remainingLength}`);
    assert(cut.status === 'active', `expected status to remain "active" at 10m remaining (above the 5m threshold), got "${cut.status}"`);
    const stock = await inventoryService.getStockLevel(warehouse._id, fabricVariantId);
    assert(stock === 10, `expected real stock to also be exactly 10 after the cut (not just the roll's own field), got ${stock}`);
  });

  await step('Cutting 6 more crosses below the 5m threshold (10 -> 4) — the roll automatically reclassifies itself as "remnant", no separate action taken', async () => {
    const cut = await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 6, userId: null });
    assert(cut.remainingLength === 4, `expected remainingLength 4 (10 - 6), got ${cut.remainingLength}`);
    assert(cut.status === 'remnant', `expected the cut ITSELF to flip status to "remnant" now that 4 < the 5m threshold, got "${cut.status}"`);
  });

  await step('Cutting more than what remains on the roll is rejected with a specific, honest error', async () => {
    let threw = false;
    let message = '';
    try {
      await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 100, userId: null });
    } catch (err) { threw = true; message = err.message; }
    assert(threw && message.includes('only 4'), `expected a rejection specifically mentioning only 4m remain, got threw=${threw} message="${message}"`);
  });

  await step('Cutting the exact remaining 4m exhausts the roll — status "exhausted", real stock lands at exactly 0', async () => {
    const cut = await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 4, userId: null });
    assert(cut.remainingLength === 0, `expected remainingLength exactly 0, got ${cut.remainingLength}`);
    assert(cut.status === 'exhausted', `expected status "exhausted" at 0 remaining, got "${cut.status}"`);
    const stock = await inventoryService.getStockLevel(warehouse._id, fabricVariantId);
    assert(stock === 0, `expected real stock to be exactly 0 after exhausting the roll, got ${stock}`);
  });

  await step('Attempting to cut from an already-exhausted roll is rejected outright', async () => {
    let threw = false;
    try {
      await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 1, userId: null });
    } catch { threw = true; }
    assert(threw, 'expected cutting from an exhausted roll to be rejected');
  });

  // --- 30. Hardware industry module: tool rental with a condition-based three-way outcome — money AND inventory availability both branch on assessed condition ---
  await step('Enable the hardware module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'hardware' } });
  });

  const drillProduct = await step('Create a rentable tool with 5 units of opening stock', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Drill Machine', sku: `DRILL-${suffix}`,
      trackingMode: 'simple', costPrice: 8000, sellingPrice: 15000,
      variants: [{ sku: `DRILL-${suffix}`, sellingPrice: 15000 }],
    });
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
      type: 'adjustment', quantity: 5, note: 'Smoke test opening stock for rentable tool',
    });
    return p;
  });
  const drillVariantId = drillProduct.variants[0]._id;

  const rentalUsageProduct = await step('Create the rental usage billing product — trackingMode "service"', () =>
    Product.create({
      companyId: company._id, name: 'Tool Rental Usage', sku: `RENTUSE-${suffix}`,
      trackingMode: 'service', costPrice: 0, sellingPrice: 0,
      variants: [{ sku: `RENTUSE-${suffix}`, sellingPrice: 0 }],
    })
  );
  const rentalDepositLiability = await Account.create({ companyId: company._id, name: 'Rental Deposits', type: 'liability' });
  const damageRevenueAccount = await Account.create({ companyId: company._id, name: 'Damage & Loss Revenue', type: 'income' });

  await step('Checking out a rental deducts real stock (5 -> 4) and posts a real deposit voucher', async () => {
    const stockBefore = await inventoryService.getStockLevel(warehouse._id, drillVariantId);
    await toolRentalService.checkOutRental({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      productId: drillProduct._id, variantId: drillVariantId, customerId: customer._id,
      dailyRate: 500, depositAmount: 5000, expectedReturnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      depositReceivedInAccountId: cash._id, depositLiabilityAccountId: rentalDepositLiability._id,
      rentalBillingProductId: rentalUsageProduct._id, rentalBillingVariantId: rentalUsageProduct.variants[0]._id,
      userId: null,
    });
    const stockAfter = await inventoryService.getStockLevel(warehouse._id, drillVariantId);
    assert(stockAfter === stockBefore - 1, `expected stock to drop by exactly 1 on checkout, went from ${stockBefore} to ${stockAfter}`);
  });

  await step('Returning in GOOD condition after 2 days: full deposit refund, item restocked, usage charge billed at 2×500=1000', async () => {
    const [rental] = await toolRentalService.listRentals(company._id, { status: 'out' });
    const stockBeforeReturn = await inventoryService.getStockLevel(warehouse._id, drillVariantId);

    const returned = await toolRentalService.returnRental(rental._id, {
      condition: 'good', actualReturnDate: new Date(rental.checkOutDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: null,
    });

    assert(returned.rentalCharge === 1000, `expected rentalCharge 1000 (2 days × 500), got ${returned.rentalCharge}`);
    assert(returned.depositRefunded === 5000 && returned.depositForfeited === 0, `expected full 5000 refund and 0 forfeited for "good" condition, got refunded=${returned.depositRefunded} forfeited=${returned.depositForfeited}`);
    assert(returned.restocked === true, 'expected a "good" condition return to be restocked');

    const stockAfterReturn = await inventoryService.getStockLevel(warehouse._id, drillVariantId);
    assert(stockAfterReturn === stockBeforeReturn + 1, `expected stock to go back up by exactly 1 on a "good" return, went from ${stockBeforeReturn} to ${stockAfterReturn}`);

    const Voucher = require('./models/Voucher');
    const voucher = await Voucher.findById(returned.voucherId);
    const totalDebit = voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 5000 && totalCredit === 5000, `expected the "good" return voucher to balance at exactly 5000 (liability cleared, full cash refund), got debit=${totalDebit} credit=${totalCredit}`);
  });

  await step('A SECOND rental returned with MINOR damage at a custom 30% forfeit: partial refund, item STILL restocked (assumed repairable)', async () => {
    await toolRentalService.checkOutRental({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      productId: drillProduct._id, variantId: drillVariantId, customerId: customer._id,
      dailyRate: 500, depositAmount: 5000, expectedReturnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      depositReceivedInAccountId: cash._id, depositLiabilityAccountId: rentalDepositLiability._id,
      rentalBillingProductId: rentalUsageProduct._id, rentalBillingVariantId: rentalUsageProduct.variants[0]._id,
      userId: null,
    });
    const [rental2] = await toolRentalService.listRentals(company._id, { status: 'out' });
    const stockBeforeReturn = await inventoryService.getStockLevel(warehouse._id, drillVariantId);

    const returned = await toolRentalService.returnRental(rental2._id, {
      condition: 'minor_damage', forfeitPercentForMinorDamage: 30,
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, damageRevenueAccountId: damageRevenueAccount._id, userId: null,
    });

    assert(returned.depositForfeited === 1500, `expected 1500 forfeited (30% of 5000), got ${returned.depositForfeited}`);
    assert(returned.depositRefunded === 3500, `expected 3500 refunded (the remaining 70%), got ${returned.depositRefunded}`);
    assert(returned.restocked === true, 'expected minor damage to still be restocked — assumed repairable, unlike major damage/loss');

    const stockAfterReturn = await inventoryService.getStockLevel(warehouse._id, drillVariantId);
    assert(stockAfterReturn === stockBeforeReturn + 1, 'expected stock to go back up even on a minor-damage return, since it\'s still restocked');
  });

  await step('A THIRD rental returned as LOST/MAJOR DAMAGE: full deposit forfeited, item NEVER restocked — permanently gone', async () => {
    const stockBeforeCheckout = await inventoryService.getStockLevel(warehouse._id, drillVariantId);
    await toolRentalService.checkOutRental({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      productId: drillProduct._id, variantId: drillVariantId, customerId: customer._id,
      dailyRate: 500, depositAmount: 5000, expectedReturnDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      depositReceivedInAccountId: cash._id, depositLiabilityAccountId: rentalDepositLiability._id,
      rentalBillingProductId: rentalUsageProduct._id, rentalBillingVariantId: rentalUsageProduct.variants[0]._id,
      userId: null,
    });
    const [rental3] = await toolRentalService.listRentals(company._id, { status: 'out' });

    const returned = await toolRentalService.returnRental(rental3._id, {
      condition: 'lost_or_major_damage',
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, damageRevenueAccountId: damageRevenueAccount._id, userId: null,
    });

    assert(returned.depositForfeited === 5000 && returned.depositRefunded === 0, `expected the FULL 5000 deposit forfeited and 0 refunded for a lost/major-damage return, got forfeited=${returned.depositForfeited} refunded=${returned.depositRefunded}`);
    assert(returned.restocked === false, 'expected a lost/major-damage item to NEVER be restocked');

    const stockAfterReturn = await inventoryService.getStockLevel(warehouse._id, drillVariantId);
    assert(stockAfterReturn === stockBeforeCheckout - 1, `expected stock to remain exactly 1 lower than before this rental's checkout (the item never came back), before-checkout was ${stockBeforeCheckout}, after-return is ${stockAfterReturn}`);
  });

  // --- 31. Retail industry module: layaway — an open-ended series of partial payments auto-completing the moment the cumulative total crosses the price ---
  await step('Enable the retail module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'retail' } });
  });

  const tvProduct = await step('Create a product with 10 units of opening stock', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Smart TV', sku: `TV-${suffix}`,
      trackingMode: 'simple', costPrice: 2000, sellingPrice: 3000,
      variants: [{ sku: `TV-${suffix}`, sellingPrice: 3000 }],
    });
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
      type: 'adjustment', quantity: 10, note: 'Smoke test opening stock for layaway item',
    });
    return p;
  });
  const tvVariantId = tvProduct.variants[0]._id;
  const layawayLiabilityAccount = await Account.create({ companyId: company._id, name: 'Layaway Deposits', type: 'liability' });

  const plan = await step('Opening a 3000 layaway plan reserves 1 unit — on-hand stock unchanged, reservedQuantity up by exactly 1', async () => {
    const StockLevel = require('./models/StockLevel');
    const before = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });

    const p = await layawayService.createPlan({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      productId: tvProduct._id, variantId: tvVariantId, customerId: customer._id,
      totalPrice: 3000, depositLiabilityAccountId: layawayLiabilityAccount._id, userId: null,
    });

    const after = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });
    assert(after.quantity === before.quantity, `expected on-hand quantity unchanged by opening a layaway plan (10), got ${after.quantity}`);
    assert(after.reservedQuantity === (before.reservedQuantity || 0) + 1, `expected reservedQuantity to increase by exactly 1, went from ${before.reservedQuantity || 0} to ${after.reservedQuantity}`);
    return p;
  });

  await step('First payment of 1000 leaves the plan active with 2000 remaining — NOT completed yet', async () => {
    const result = await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: cash._id, userId: null });
    assert(result.completed === false, 'expected the plan to still be active after only 1000 of 3000 paid');
    assert(result.remaining === 2000, `expected remaining 2000 (3000 - 1000), got ${result.remaining}`);
    assert(result.plan.status === 'active', `expected plan status "active", got "${result.plan.status}"`);
  });

  await step('Second payment of 1000 leaves 1000 remaining — still active', async () => {
    const result = await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: cash._id, userId: null });
    assert(result.completed === false && result.remaining === 1000, `expected still active with 1000 remaining, got completed=${result.completed} remaining=${result.remaining}`);
  });

  await step('The THIRD payment of exactly 1000 crosses the threshold — completes the plan automatically in this SAME call: reservation released, real stock deducted, a real Sale created for the full 3000', async () => {
    const StockLevel = require('./models/StockLevel');
    const before = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });

    const result = await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: cash._id, userId: null });

    assert(result.completed === true, 'expected the plan to auto-complete on the exact payment that crosses the threshold — no separate "finish" action should be needed');
    assert(result.plan.status === 'completed', `expected plan status "completed", got "${result.plan.status}"`);
    assert(result.sale.totalAmount === 3000, `expected the completing Sale to total the full 3000, got ${result.sale.totalAmount}`);

    const after = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });
    assert(after.reservedQuantity === (before.reservedQuantity || 0) - 1, `expected the reservation to be released (reservedQuantity down by 1) on completion, went from ${before.reservedQuantity} to ${after.reservedQuantity}`);
    assert(after.quantity === before.quantity - 1, `expected real on-hand stock to actually be deducted by 1 on completion, went from ${before.quantity} to ${after.quantity}`);
  });

  await step('Attempting to pay toward an already-completed plan is rejected, not silently accepted', async () => {
    let threw = false;
    try {
      await layawayService.makePayment(plan._id, { amount: 100, paymentAccountId: cash._id, userId: null });
    } catch { threw = true; }
    assert(threw, 'expected a payment toward a completed plan to be rejected');
  });

  await step('A SEPARATE plan cancelled while still active releases its reservation without ever touching real stock or creating a Sale', async () => {
    const StockLevel = require('./models/StockLevel');
    const plan2 = await layawayService.createPlan({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      productId: tvProduct._id, variantId: tvVariantId, customerId: customer._id,
      totalPrice: 3000, depositLiabilityAccountId: layawayLiabilityAccount._id, userId: null,
    });
    await layawayService.makePayment(plan2._id, { amount: 500, paymentAccountId: cash._id, userId: null });

    const before = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });
    const cancelled = await layawayService.cancelPlan(plan2._id, { refundPercent: 100, refundAccountId: cash._id, userId: null });
    const after = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });

    assert(cancelled.status === 'cancelled', `expected status "cancelled", got "${cancelled.status}"`);
    assert(after.reservedQuantity === before.reservedQuantity - 1, 'expected the reservation to be released on cancellation');
    assert(after.quantity === before.quantity, 'expected on-hand stock to be completely untouched by a cancellation — nothing was ever actually sold');
  });

  // --- 32. Cafe industry module: daily-resetting subscription redemption cap — genuinely different from Salon's depleting-balance membership ---
  await step('Enable the cafe module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'cafe' } });
  });

  const coffeeProduct = await step('Create the "free coffee" redeem product with 10 units of opening stock', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Regular Coffee', sku: `COFFEE-${suffix}`,
      trackingMode: 'simple', costPrice: 50, sellingPrice: 200,
      variants: [{ sku: `COFFEE-${suffix}`, sellingPrice: 200 }],
    });
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
      type: 'adjustment', quantity: 10, note: 'Smoke test opening stock for cafe subscription redemptions',
    });
    return p;
  });

  const subscriptionFeeProduct = await step('Create the subscription-fee billing product — trackingMode "service"', () =>
    Product.create({
      companyId: company._id, name: 'Coffee Club Membership', sku: `CLUB-${suffix}`,
      trackingMode: 'service', costPrice: 0, sellingPrice: 0,
      variants: [{ sku: `CLUB-${suffix}`, sellingPrice: 0 }],
    })
  );

  const subscription = await step('Sell a "1 free coffee/day" subscription — bills 2000 through the ordinary checkout', async () => {
    const s = await cafeSubscriptionService.sellSubscription({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      planName: 'Coffee Club', startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dailyLimit: 1, subscriptionBillingProductId: subscriptionFeeProduct._id, subscriptionBillingVariantId: subscriptionFeeProduct.variants[0]._id,
      subscriptionPrice: 2000, redeemProductId: coffeeProduct._id, redeemVariantId: coffeeProduct.variants[0]._id,
      paymentAccountId: cash._id, userId: null,
    });
    assert(s.status === 'active', `expected subscription status "active", got "${s.status}"`);
    return s;
  });

  await step('First redemption of the day succeeds and deducts real stock by 1', async () => {
    const stockBefore = await inventoryService.getStockLevel(warehouse._id, coffeeProduct.variants[0]._id);
    const result = await cafeSubscriptionService.redeemDaily(subscription._id, { warehouseId: warehouse._id, userId: null });
    assert(result.redemptionsToday === 1, `expected redemptionsToday 1 after the first redemption, got ${result.redemptionsToday}`);
    const stockAfter = await inventoryService.getStockLevel(warehouse._id, coffeeProduct.variants[0]._id);
    assert(stockAfter === stockBefore - 1, `expected real stock to drop by exactly 1, went from ${stockBefore} to ${stockAfter}`);
  });

  await step('A SECOND redemption the SAME day is rejected — today\'s single-drink allowance is already used', async () => {
    let threw = false;
    let message = '';
    try {
      await cafeSubscriptionService.redeemDaily(subscription._id, { warehouseId: warehouse._id, userId: null });
    } catch (err) { threw = true; message = err.message; }
    assert(threw && message.includes('already been used'), `expected a same-day second redemption to be rejected with a clear "already used" message, got threw=${threw} message="${message}"`);
  });

  await step('Simulating a day passing (backdating lastRedemptionDate to yesterday) — the SAME subscription can redeem again, proving the cap genuinely resets per calendar day rather than being a one-time-only pool', async () => {
    const CafeSubscription = require('./modules/cafe/models/CafeSubscription');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await CafeSubscription.findByIdAndUpdate(subscription._id, { lastRedemptionDate: yesterday });

    const result = await cafeSubscriptionService.redeemDaily(subscription._id, { warehouseId: warehouse._id, userId: null });
    assert(result.redemptionsToday === 1, `expected redemptionsToday to reset to 1 on a new calendar day, not accumulate to 2, got ${result.redemptionsToday}`);
    assert(result.totalRedemptions === 2, `expected the LIFETIME total to correctly be 2 (this is the informational running count, unlike the daily one which resets), got ${result.totalRedemptions}`);
  });

  await step('An already-expired subscription is rejected on redemption and flips its own status to "expired"', async () => {
    const expiredSub = await cafeSubscriptionService.sellSubscription({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      planName: 'Expired Plan', startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      dailyLimit: 1, subscriptionBillingProductId: subscriptionFeeProduct._id, subscriptionBillingVariantId: subscriptionFeeProduct.variants[0]._id,
      subscriptionPrice: 2000, redeemProductId: coffeeProduct._id, redeemVariantId: coffeeProduct.variants[0]._id,
      paymentAccountId: cash._id, userId: null,
    });

    let threw = false;
    try {
      await cafeSubscriptionService.redeemDaily(expiredSub._id, { warehouseId: warehouse._id, userId: null });
    } catch { threw = true; }
    assert(threw, 'expected redemption against an expired subscription to be rejected');

    const CafeSubscription = require('./modules/cafe/models/CafeSubscription');
    const refreshed = await CafeSubscription.findById(expiredSub._id);
    assert(refreshed.status === 'expired', `expected the subscription's own status to flip to "expired" as a side effect of the rejected redemption attempt, got "${refreshed.status}"`);
  });

  await step('A redemption against a product with zero stock is rejected — a free redemption still has to respect real inventory', async () => {
    const teaProduct = await Product.create({
      companyId: company._id, name: 'Herbal Tea', sku: `TEA-${suffix}`,
      trackingMode: 'simple', costPrice: 30, sellingPrice: 150,
      variants: [{ sku: `TEA-${suffix}`, sellingPrice: 150 }],
    }); // deliberately given ZERO opening stock

    const teaSub = await cafeSubscriptionService.sellSubscription({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      planName: 'Tea Club', startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      dailyLimit: 1, subscriptionBillingProductId: subscriptionFeeProduct._id, subscriptionBillingVariantId: subscriptionFeeProduct.variants[0]._id,
      subscriptionPrice: 2000, redeemProductId: teaProduct._id, redeemVariantId: teaProduct.variants[0]._id,
      paymentAccountId: cash._id, userId: null,
    });

    let threw = false;
    try {
      await cafeSubscriptionService.redeemDaily(teaSub._id, { warehouseId: warehouse._id, userId: null });
    } catch { threw = true; }
    assert(threw, 'expected a redemption against a zero-stock product to be rejected, not silently given away');
  });

  // --- 33. Toys & Gifts industry module: gift registry — a SHARED quota multiple independent purchasers draw down, proven race-safe under real concurrency ---
  await step('Enable the toys_gifts module for this company', async () => {
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'toys_gifts' } });
  });

  const toyProduct = await step('Create a giftable product with plenty of stock', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Building Blocks Set', sku: `TOY-${suffix}`,
      trackingMode: 'simple', costPrice: 500, sellingPrice: 1000,
      variants: [{ sku: `TOY-${suffix}`, sellingPrice: 1000 }],
    });
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
      type: 'adjustment', quantity: 50, note: 'Smoke test opening stock for gift registry item',
    });
    return p;
  });

  const [registryOwner, buyerA, buyerB, buyerC] = await step('Create the registry owner and 3 independent, unrelated buyers', () =>
    Promise.all([
      Customer.create({ companyId: company._id, name: 'Registry Owner' }),
      Customer.create({ companyId: company._id, name: 'Buyer A' }),
      Customer.create({ companyId: company._id, name: 'Buyer B' }),
      Customer.create({ companyId: company._id, name: 'Buyer C' }),
    ])
  );

  const registry = await step('Create a registry wanting exactly 5 of the toy — a shared quota, not any one purchaser\'s own balance', () =>
    giftRegistryService.createRegistry({
      companyId: company._id, branchId: branch._id, ownerCustomerId: registryOwner._id, occasion: 'Baby Shower',
      items: [{ productId: toyProduct._id, variantId: toyProduct.variants[0]._id, desiredQuantity: 5 }],
    })
  );
  const registryItemId = registry.items[0]._id;

  await step('Buyer A purchases 2 sequentially — succeeds, real Sale created, registry shows 2/5 claimed', async () => {
    const result = await giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, {
      quantity: 2, purchasingCustomerId: buyerA._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null,
    });
    assert(result.sale.totalAmount === 2000, `expected buyer A's sale to total 2000 (2 × 1000), got ${result.sale.totalAmount}`);
    const item = result.registry.items.id(registryItemId);
    assert(item.purchasedQuantity === 2, `expected purchasedQuantity 2 after buyer A's purchase, got ${item.purchasedQuantity}`);
  });

  await step('THE CRITICAL TEST: 3 buyers attempt to purchase 2 each — SIMULTANEOUSLY, via real concurrent requests — against only 3 remaining (5 total - 2 already claimed). A naive read-then-write implementation would let all 3 succeed (over-claiming to 8); the atomic DB-level guard must allow exactly enough to fit and reject the rest', async () => {
    const results = await Promise.allSettled([
      giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, { quantity: 2, purchasingCustomerId: buyerB._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null }),
      giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, { quantity: 2, purchasingCustomerId: buyerC._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    // Only 3 remain (5 - 2). Two concurrent requests for 2 each = 4 requested against 3 available — mathematically, AT MOST one of the two can succeed (2 fits within 3; a second 2 would make 4, which doesn't). Exactly one must succeed, one must fail — not both succeeding (which would prove the race condition is real) and not both failing (which would mean the guard is overly strict).
    assert(fulfilled.length === 1 && rejected.length === 1, `expected exactly 1 of the 2 concurrent purchases to succeed and 1 to be correctly rejected as not fitting, got ${fulfilled.length} fulfilled and ${rejected.length} rejected`);

    const finalRegistry = await giftRegistryService.getRegistry(registry._id);
    const finalItem = finalRegistry.items.id(registryItemId);
    assert(finalItem.purchasedQuantity === 4, `expected the registry's shared counter to land at EXACTLY 4 (2 from buyer A + 2 from whichever concurrent buyer won) — never 6, which is what it would be if both concurrent purchases had incorrectly succeeded, got ${finalItem.purchasedQuantity}`);
  });

  await step('A final purchase for the last 1 remaining unit succeeds — exactly the boundary, not one more', async () => {
    const result = await giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, {
      quantity: 1, purchasingCustomerId: buyerA._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null,
    });
    const item = result.registry.items.id(registryItemId);
    assert(item.purchasedQuantity === 5, `expected purchasedQuantity to reach exactly 5 (fully claimed), got ${item.purchasedQuantity}`);
  });

  await step('Any further purchase attempt is rejected with a specific, honest message — nothing remains', async () => {
    let threw = false;
    let message = '';
    try {
      await giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, {
        quantity: 1, purchasingCustomerId: buyerB._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null,
      });
    } catch (err) { threw = true; message = err.message; }
    assert(threw && message.includes('0 of this item remain'), `expected a rejection specifically stating 0 remain, got threw=${threw} message="${message}"`);
  });

  // --- 34. Petrol Pump: sale quantity DERIVED from meter readings, not entered ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'petrol_pump' } });
  const fuelProduct = await Product.create({
    companyId: company._id, name: 'Petrol', sku: `FUEL-${suffix}`,
    trackingMode: 'service', costPrice: 0, sellingPrice: 0,
    variants: [{ sku: `FUEL-${suffix}`, sellingPrice: 0 }],
  });
  const dispenser = await fuelShiftService.createDispenser({ companyId: company._id, branchId: branch._id, name: 'Pump 1', productId: fuelProduct._id, variantId: fuelProduct.variants[0]._id, currentMeterReading: 1000 });
  await step('Opening a shift baselines at the dispenser\'s CURRENT reading (1000), not zero', async () => {
    const shift = await fuelShiftService.openShift(dispenser._id, { pricePerLitre: 250, userId: null });
    assert(shift.openingReading === 1000, `expected openingReading 1000, got ${shift.openingReading}`);
    return shift;
  });
  await step('Closing at 1150 derives EXACTLY 150 litres sold (1150-1000) and bills 150 × 250 = 37500 — nobody entered "150" anywhere', async () => {
    const [openShift] = await fuelShiftService.listShifts(company._id, { status: 'open' });
    const result = await fuelShiftService.closeShift(openShift._id, {
      closingReading: 1150, warehouseId: warehouse._id, customerId: customer._id, paymentAccountId: cash._id,
      billingProductId: fuelProduct._id, billingVariantId: fuelProduct.variants[0]._id, userId: null,
    });
    assert(result.litresSold === 150, `expected litresSold 150 (1150-1000), got ${result.litresSold}`);
    assert(result.totalAmount === 37500, `expected totalAmount 37500 (150 × 250), got ${result.totalAmount}`);
    const updatedDispenser = await require('./modules/petrol_pump/models/FuelDispenser').findById(dispenser._id);
    assert(updatedDispenser.currentMeterReading === 1150, `expected the dispenser's own running total to advance to 1150 for the next shift to open from, got ${updatedDispenser.currentMeterReading}`);
  });
  await step('A closing reading LOWER than opening is rejected — the meter cannot run backward', async () => {
    await fuelShiftService.openShift(dispenser._id, { pricePerLitre: 250, userId: null });
    let threw = false;
    try {
      const [openShift] = await fuelShiftService.listShifts(company._id, { status: 'open' });
      await fuelShiftService.closeShift(openShift._id, { closingReading: 1000, warehouseId: warehouse._id, billingProductId: fuelProduct._id, billingVariantId: fuelProduct.variants[0]._id, userId: null });
    } catch { threw = true; }
    assert(threw, 'expected a closing reading below the opening reading to be rejected');
  });

  // --- 35. Courier: enforced status chain, illegal skips rejected, delivery bills and closes ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'courier' } });
  const shipment = await shipmentService.createShipment({ companyId: company._id, branchId: branch._id, customerId: customer._id, trackingNumber: `TRK-${suffix}`, origin: 'Karachi', destination: 'Lahore' });
  await step('A shipment cannot skip straight from "booked" to "delivered" — the chain is enforced, not just a free-text status field', async () => {
    let threw = false;
    try { await shipmentService.advanceStatus(shipment._id, { status: 'delivered' }); } catch { threw = true; }
    assert(threw, 'expected skipping directly to "delivered" from "booked" to be rejected');
  });
  await step('The real path — booked -> picked_up -> in_transit -> out_for_delivery -> delivered — succeeds step by step, and history accumulates rather than being overwritten', async () => {
    await shipmentService.advanceStatus(shipment._id, { status: 'picked_up', location: 'Karachi' });
    await shipmentService.advanceStatus(shipment._id, { status: 'in_transit', location: 'En route' });
    const advanced = await shipmentService.advanceStatus(shipment._id, { status: 'out_for_delivery', location: 'Lahore' });
    assert(advanced.history.length === 4, `expected 4 history events (booked + 3 advances), got ${advanced.history.length}`);
  });
  await step('Marking delivered bills the shipping fee for real and the shipment becomes terminal — no further transition is legal', async () => {
    const shippingFeeProduct = await Product.create({ companyId: company._id, name: 'Shipping Fee', sku: `SHIP-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `SHIP-${suffix}`, sellingPrice: 0 }] });
    const { shipment: delivered, sale } = await shipmentService.markDelivered(shipment._id, {
      proofOfDeliveryNote: 'Signed by receptionist', shippingFeeProductId: shippingFeeProduct._id, shippingFeeVariantId: shippingFeeProduct.variants[0]._id,
      shippingFee: 500, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null,
    });
    assert(sale.totalAmount === 500, `expected the shipping fee sale to total 500, got ${sale.totalAmount}`);
    assert(delivered.status === 'delivered', `expected status "delivered", got "${delivered.status}"`);
    let threw = false;
    try { await shipmentService.advanceStatus(shipment._id, { status: 'in_transit' }); } catch { threw = true; }
    assert(threw, 'expected any further transition on a delivered (terminal) shipment to be rejected');
  });

  // --- 36. Dairy: quality-graded (fat %) pricing — highest band met, boundary inclusive ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'dairy' } });
  const gradeSchedule = await dairyCollectionService.createSchedule({
    companyId: company._id, name: 'Standard Milk Grades',
    bands: [{ minFatPercent: 3.0, pricePerLitre: 100 }, { minFatPercent: 4.0, pricePerLitre: 120 }, { minFatPercent: 5.0, pricePerLitre: 140 }],
  });
  const expenseAcct = await Account.create({ companyId: company._id, name: 'Milk Purchase Expense', type: 'expense' });
  const payableAcct = await Account.create({ companyId: company._id, name: 'Accounts Payable - Farmers', type: 'liability' });
  await step('50 litres at exactly 4.0% fat lands on the 4.0 band (120/L), not the 3.0 band — hand-traced: 50 × 120 = 6000', async () => {
    const collection = await dairyCollectionService.recordCollection({
      companyId: company._id, branchId: branch._id, supplierId: supplier._id, litres: 50, fatPercent: 4.0,
      scheduleId: gradeSchedule._id, expenseAccountId: expenseAcct._id, payableAccountId: payableAcct._id, userId: null,
    });
    assert(collection.pricePerLitre === 120, `expected the 4.0% band (120/L) to apply at exactly 4.0%, got ${collection.pricePerLitre}`);
    assert(collection.totalPayable === 6000, `expected totalPayable 6000 (50 × 120), got ${collection.totalPayable}`);

    const voucher = await require('./models/Voucher').findById(collection.voucherId);
    const totalDebit = voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 6000 && totalCredit === 6000, `expected the payable voucher to balance at exactly 6000, got debit=${totalDebit} credit=${totalCredit}`);
  });
  await step('Milk testing below the lowest band (2.5%, below the 3.0% floor) is rejected, not priced at zero or the lowest band anyway', async () => {
    let threw = false;
    try {
      await dairyCollectionService.recordCollection({ companyId: company._id, branchId: branch._id, supplierId: supplier._id, litres: 10, fatPercent: 2.5, scheduleId: gradeSchedule._id, userId: null });
    } catch { threw = true; }
    assert(threw, 'expected fat content below the lowest configured band to be rejected');
  });

  // --- 37. Car Rental: fleet POOL availability — assigns ANY free unit in a class, not one named resource ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'car_rental' } });
  const [vehicleA, vehicleB] = await Promise.all([
    carRentalService.addVehicle({ companyId: company._id, branchId: branch._id, vehicleClass: 'Compact', registrationNumber: `CAR-A-${suffix}`, dailyRate: 3000 }),
    carRentalService.addVehicle({ companyId: company._id, branchId: branch._id, vehicleClass: 'Compact', registrationNumber: `CAR-B-${suffix}`, dailyRate: 3000 }),
  ]);
  const carUsageProduct = await Product.create({ companyId: company._id, name: 'Car Rental Usage', sku: `CARUSE-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `CARUSE-${suffix}`, sellingPrice: 0 }] });
  const rentalStart = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const rentalEnd = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);

  const carBooking1 = await step('Booking a Compact for the first time is assigned to one of the two available vehicles', () =>
    carRentalService.bookRental({
      companyId: company._id, branchId: branch._id, vehicleClass: 'Compact', customerId: customer._id,
      startDate: rentalStart, endDate: rentalEnd, rentalBillingProductId: carUsageProduct._id, rentalBillingVariantId: carUsageProduct.variants[0]._id, userId: null,
    })
  );
  await step('A SECOND overlapping booking for the same class is assigned the OTHER vehicle — pool search, not a single resource\'s calendar', async () => {
    const carBooking2 = await carRentalService.bookRental({
      companyId: company._id, branchId: branch._id, vehicleClass: 'Compact', customerId: customer._id,
      startDate: rentalStart, endDate: rentalEnd, rentalBillingProductId: carUsageProduct._id, rentalBillingVariantId: carUsageProduct.variants[0]._id, userId: null,
    });
    assert(String(carBooking2.vehicleId) !== String(carBooking1.vehicleId), 'expected the second overlapping booking to be assigned a DIFFERENT vehicle than the first');
  });
  await step('A THIRD overlapping booking fails — both vehicles in the class are now taken for those dates', async () => {
    let threw = false;
    try {
      await carRentalService.bookRental({
        companyId: company._id, branchId: branch._id, vehicleClass: 'Compact', customerId: customer._id,
        startDate: rentalStart, endDate: rentalEnd, rentalBillingProductId: carUsageProduct._id, rentalBillingVariantId: carUsageProduct.variants[0]._id, userId: null,
      });
    } catch { threw = true; }
    assert(threw, 'expected a third overlapping booking to fail once both pool vehicles are taken');
  });
  await step('Returning the first booking after 3 days bills exactly 3 × 3000 = 9000', async () => {
    const result = await carRentalService.returnVehicle(carBooking1._id, { actualReturnDate: new Date(rentalStart.getTime() + 3 * 24 * 60 * 60 * 1000), warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: null });
    assert(result.days === 3 && result.rentalCharge === 9000, `expected 3 days at 9000 total, got days=${result.days} charge=${result.rentalCharge}`);
  });

  // --- 38. Warehouse/3PL: storage fee is a real time-quantity INTEGRAL, hand-traced against a manually-computed step function ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'warehouse_3pl' } });
  const storageBillingProduct = await Product.create({ companyId: company._id, name: 'Storage Fee', sku: `STORE-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `STORE-${suffix}`, sellingPrice: 0 }] });
  const periodStart = new Date();
  const periodEnd = new Date(periodStart.getTime() + 10 * 24 * 60 * 60 * 1000);
  const contract = await storageContractService.createContract({
    companyId: company._id, branchId: branch._id, clientCustomerId: customer._id, productId: product._id, variantId,
    ratePerUnitPerDay: 2, billingProductId: storageBillingProduct._id, billingVariantId: storageBillingProduct.variants[0]._id,
  });
  await step('Receive 100 units at period start, release 40 at day 5 — hand-traced: (100×5) + (60×5) = 800 quantity-days × 2/unit/day = 1600', async () => {
    await storageContractService.receiveGoods(contract._id, { quantity: 100, at: periodStart });
    await storageContractService.releaseGoods(contract._id, { quantity: 40, at: new Date(periodStart.getTime() + 5 * 24 * 60 * 60 * 1000) });
    const { quantityDays, fee } = await storageContractService.computeStorageFee(contract._id, periodStart, periodEnd);
    assert(quantityDays === 800, `expected 800 quantity-days (100×5 + 60×5), got ${quantityDays}`);
    assert(fee === 1600, `expected fee 1600 (800 × 2), got ${fee}`);
  });
  await step('Releasing more than what\'s currently held is rejected', async () => {
    let threw = false;
    try { await storageContractService.releaseGoods(contract._id, { quantity: 1000 }); } catch { threw = true; }
    assert(threw, 'expected releasing more than what\'s in storage to be rejected');
  });
  await step('Billing the period charges exactly the computed fee through the ordinary checkout', async () => {
    const { sale, fee } = await storageContractService.billPeriod(contract._id, { periodStart, periodEnd, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: null });
    assert(fee === 1600 && sale.totalAmount === 1600, `expected the bill to total exactly the computed 1600, got fee=${fee} saleTotal=${sale.totalAmount}`);
  });

  // --- 39. Automobile: core already handles VIN-tracked sale; the ONE new piece (trade-in) reuses Jewelry's exact shape with an honestly different valuation ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'automobile' } });
  const carProduct = await Product.create({ companyId: company._id, name: 'Sedan', sku: `SEDAN-${suffix}`, trackingMode: 'serial', costPrice: 2000000, sellingPrice: 2500000, variants: [{ sku: `SEDAN-${suffix}`, sellingPrice: 2500000 }] });
  await step('A VIN sells through the ordinary checkout exactly like an IMEI does — no new code needed for this half', async () => {
    const carPo = await purchaseService.createPurchaseOrder({ companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id, items: [{ productId: carProduct._id, variantId: carProduct.variants[0]._id, quantityOrdered: 1, unitCost: 2000000 }], userId: null });
    await purchaseService.decidePurchaseOrder(carPo._id, { approve: true, userId: null });
    await purchaseService.receiveGoods({ purchaseOrderId: carPo._id, warehouseId: warehouse._id, items: [{ purchaseOrderItemId: carPo.items[0]._id, productId: carProduct._id, variantId: carProduct.variants[0]._id, quantity: 1, unitCost: 2000000, serialNumbers: [`VIN-${suffix}`] }], userId: null });
    const sale = await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: carProduct._id, variantId: carProduct.variants[0]._id, quantity: 1, unitPrice: 2500000, serialNumbers: [`VIN-${suffix}`] }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 2500000 }],
    });
    assert(sale.totalAmount === 2500000, `expected the vehicle sale to total 2500000, got ${sale.totalAmount}`);
  });
  await step('Trade-in credit is intaken, applied as a discount on a real sale, then marked applied for audit trail', async () => {
    const credit = await tradeInService.intake({ companyId: company._id, customerId: customer._id, vehicleDescription: 'Old Corolla', appraisedValue: 100, userId: null });
    assert(credit.status === 'pending', 'trade-in starts pending until applied');

    const linkedSale = await posSaleService.checkout({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100, discountAmount: 100 }],
      payments: [],
    });
    const applied = await tradeInService.markApplied(credit._id, linkedSale._id);
    assert(applied.status === 'applied' && String(applied.saleId) === String(linkedSale._id), 'trade-in marked applied and linked to the sale it credited');
  });

  console.log(`\nAll ${stepNumber} smoke test steps passed.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(`\nSmoke test failed at step ${stepNumber}.`);
  console.error(err);
  process.exit(1);
});
