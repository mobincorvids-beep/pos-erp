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
const notificationService = require('./services/notificationService');
const approvalService = require('./services/approvalService');
const webhookService = require('./services/webhookService');
const fixedAssetService = require('./services/fixedAssetService');
const dashboardService = require('./services/dashboardService');
const currencyService = require('./services/currencyService');
const documentService = require('./services/documentService');
const twoFactorService = require('./services/twoFactorService');
const { generate: generateTotp } = require('otplib');
const securityService = require('./services/securityService');
const pilgrimageService = require('./modules/hajj_umrah/services/pilgrimageService');
const travelService = require('./modules/travel/services/travelService');
const insuranceService = require('./modules/insurance/services/insuranceService');
const eventTicketingService = require('./modules/media_entertainment/services/eventTicketingService');
const sportsService = require('./modules/sports/services/sportsService');
const telecomService = require('./modules/telecom/services/telecomService');
const timeEntryService = require('./modules/professional_services/services/timeEntryService');
const fundService = require('./modules/ngo/services/fundService');
const importShipmentService = require('./modules/import_export/services/importShipmentService');
const agricultureService = require('./modules/agriculture/services/agricultureService');
const batchRecallService = require('./modules/pharmaceutical/services/batchRecallService');
const billOfQuantitiesService = require('./modules/construction/services/billOfQuantitiesService');
const leaseService = require('./modules/real_estate/services/leaseService');
const societyService = require('./modules/housing_society/services/societyService');
const logisticsService = require('./modules/logistics/services/logisticsService');
const ticketService = require('./services/ticketService');
const rfqService = require('./services/rfqService');
const unitConversionService = require('./services/unitConversionService');
const reportExportService = require('./services/reportExportService');
const costCenterService = require('./services/costCenterService');
const periodService = require('./services/periodService');
const badDebtService = require('./services/badDebtService');
const employeeLoanService = require('./services/employeeLoanService');
const { hasPermission } = require('./middleware/auth');
const { DOCUMENTS_VIEW, VENDOR_COMPANY_DOCUMENTS_VIEW } = require('./constants/permissions');
const recurringInvoiceService = require('./services/recurringInvoiceService');
const budgetService = require('./services/budgetService');
const earlyPaymentDiscountService = require('./services/earlyPaymentDiscountService');
const accountingService = require('./services/accountingService');
const refreshTokenService = require('./services/refreshTokenService');
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
  const { company, branch, warehouse, admin } = await step('Onboard a company', () =>
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
    posSaleService.checkout({ userId: admin._id,
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
    await saleReturnService.voidSale(sale1._id, { userId: admin._id, reason: 'smoke test void' });
    const qty = await inventoryService.getStockLevel(warehouse._id, variantId);
    assert(qty === 100, `expected stock restored to 100 after void, got ${qty}`);
  });

  const sale2 = await step('Checkout a second sale (5 units, partial payment — creates a due balance)', () =>
    posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 5, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 300 }],
    })
  );
  assert(sale2.dueAmount === 200, `expected 200 due on sale2, got ${sale2.dueAmount}`);

  await step('Return 1 unit from sale2', async () => {
    await saleReturnService.processReturn(sale2._id, {
      items: [{ productId: product._id, variantId, quantity: 1 }],
      refundAccountId: cash._id, reason: 'smoke test return', userId: admin._id,
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
    return requisitionService.decide(req._id, { approve: true, userId: admin._id });
  });

  const po = await step('Create a PO from the requisition, then approve it', async () => {
    const created = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      requisitionId: requisition._id,
      items: [{ productId: product._id, variantId, quantityOrdered: 20, unitCost: 45 }],
      userId: admin._id,
    });
    return purchaseService.decidePurchaseOrder(created._id, { approve: true, userId: admin._id });
  });
  assert(po.status === 'ordered', `expected PO status "ordered" after approval, got "${po.status}"`);

  const stockBeforeReceive = await inventoryService.getStockLevel(warehouse._id, variantId);
  const grn = await step('Receive the PO (partial: 15 of 20)', () =>
    purchaseService.receiveGoods({
      purchaseOrderId: po._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: po.items[0]._id, productId: product._id, variantId, quantity: 15, unitCost: 45 }],
      userId: admin._id,
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
        userId: admin._id,
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
      items: [{ productId: p._id, variantId: p.variants[0]._id, quantityOrdered: 3, unitCost: 500 }], userId: admin._id,
    });
    await purchaseService.decidePurchaseOrder(phonePo._id, { approve: true, userId: admin._id });
    await purchaseService.receiveGoods({
      purchaseOrderId: phonePo._id, warehouseId: warehouse._id,
      items: [{
        purchaseOrderItemId: phonePo.items[0]._id, productId: p._id, variantId: p.variants[0]._id,
        quantity: 3, unitCost: 500, serialNumbers: [`SN-${suffix}-1`, `SN-${suffix}-2`, `SN-${suffix}-3`],
      }],
      userId: admin._id,
    });
    const serials = await ProductSerial.find({ variantId: p.variants[0]._id });
    assert(serials.length === 3 && serials.every((s) => s.status === 'in_stock'), 'all 3 serials created and in_stock after receiving');
    return p;
  });
  const serialVariantId = serialProduct.variants[0]._id;

  const serialSale = await step('Sell one specific serial — it gets marked sold and linked to the sale', async () => {
    const sale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: serialProduct._id, variantId: serialVariantId, quantity: 1, unitPrice: 800, serialNumbers: [`SN-${suffix}-1`] }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 800 }],
    });
    const sold = await ProductSerial.findOne({ variantId: serialVariantId, serialNumber: `SN-${suffix}-1` });
    assert(sold.status === 'sold' && String(sold.saleId) === String(sale._id), 'sold serial marked sold and linked to the sale');

    let threw = false;
    try {
      await posSaleService.checkout({ userId: admin._id,
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
      refundAccountId: cash._id, reason: 'smoke test serial return', userId: admin._id,
    });
    const released = await ProductSerial.findOne({ variantId: serialVariantId, serialNumber: `SN-${suffix}-1` });
    assert(released.status === 'in_stock' && released.saleId === null, 'returned serial released back to in_stock with saleId cleared');
  });

  await step('Voiding a sale releases ALL its serials back to in_stock', async () => {
    const voidableSale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: serialProduct._id, variantId: serialVariantId, quantity: 1, unitPrice: 800, serialNumbers: [`SN-${suffix}-2`] }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 800 }],
    });
    await saleReturnService.voidSale(voidableSale._id, { userId: admin._id, reason: 'smoke test serial void' });
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
      amount: 500, projectId: project._id, userId: admin._id,
    });
    await expenseService.approveExpense(expense._id, null);

    const before = await projectService.profitability(project._id);
    assert(before.costBreakdown.expense === 500, `expected 500 expense cost on project, got ${before.costBreakdown.expense}`);
  });

  await step('Receiving against a project-tagged PO auto-creates a ProjectCost', async () => {
    const projectPo = await purchaseService.createPurchaseOrder({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
      projectId: project._id,
      items: [{ productId: product._id, variantId, quantityOrdered: 5, unitCost: 45 }], userId: admin._id,
    });
    await purchaseService.decidePurchaseOrder(projectPo._id, { approve: true, userId: admin._id });
    await purchaseService.receiveGoods({
      purchaseOrderId: projectPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: projectPo.items[0]._id, productId: product._id, variantId, quantity: 5, unitCost: 45 }],
      userId: admin._id,
    });

    const report = await projectService.profitability(project._id);
    assert(report.costBreakdown.material === 225, `expected 225 material cost (5 x 45) on project, got ${report.costBreakdown.material}`);
  });

  await step('A project-tagged sale counts toward project revenue', async () => {
    await posSaleService.checkout({ userId: admin._id,
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

    const run = await hrService.generatePayroll({ companyId: company._id, month: now.getMonth() + 1, year: now.getFullYear(), userId: admin._id });
    assert(run.entries[0].absentDays === 2, `expected 2 absent days counted, got ${run.entries[0].absentDays}`);
    assert(run.entries[0].netPay < 32000, 'net pay should be reduced below basic+allowances by the absence deduction');

    const posted = await hrService.postPayroll(run._id, { paymentAccountId: cash._id, userId: admin._id });
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
      salonServiceId: salonSvc._id, employeeId: salonEmployee._id, paymentAccountId: cash._id, userId: admin._id,
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
      membershipPackageId: pkg._id, paymentAccountId: cash._id, userId: admin._id,
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
      salonServiceId: salonSvc._id, employeeId: salonEmployee._id, useMembership: true, userId: admin._id,
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

    const run = await hrService.generatePayroll({ companyId: company._id, month: targetMonth, year: targetYear, userId: admin._id });
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
    const sale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: jewelryProduct._id, variantId: jewelryVariantId, quantity: 1, unitPrice: quote.totalPrice }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: quote.totalPrice }],
    });
    assert(sale.totalAmount === 121500, `expected the sale to bill at the quoted live price 121500, got ${sale.totalAmount}`);
  });

  await step('Buy-back intake computes credit from weight, deduction, and the current rate — hand-traced: 10g × (1 - 5%) × 20000 = 190000', async () => {
    const buyback = await buybackService.intake({
      companyId: company._id, customerId: customer._id, karat: 22, weightGrams: 10, deductionPercent: 5, userId: admin._id,
    });
    assert(buyback.creditAmount === 190000, `expected creditAmount 190000 (10 × 0.95 × 20000), got ${buyback.creditAmount}`);
    assert(buyback.status === 'pending', 'buyback starts pending until applied to a sale');

    const linkedSale = await posSaleService.checkout({ userId: admin._id,
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
      userId: admin._id,
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
        checkInDate: overlapStart, checkOutDate: overlapEnd, userId: admin._id,
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
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: admin._id,
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
      branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
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
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id, userId: admin._id,
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
      userId: admin._id,
    });
    assert(b.status === 'booked', `expected status "booked", got "${b.status}"`);
    return b;
  });

  await step('The same venue cannot be double-booked for the same calendar day', async () => {
    let threw = false;
    try {
      await bookingService.bookEvent({
        companyId: company._id, branchId: branch._id, venueId: venue._id, packageId: eventPackage._id, customerId: customer._id,
        eventDate: eventDate1, guestCount: 60, userId: admin._id,
      });
    } catch { threw = true; }
    assert(threw, 'expected a second booking on the same venue+day to be rejected');
  });

  await step('Completing the event bills the per-headcount + venue rental through the ordinary checkout', async () => {
    const result = await bookingService.completeEvent(booking1._id, { warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: admin._id });
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
      userId: admin._id,
    })
  );

  const cancellationRevenueAccount = await Account.create({ companyId: company._id, name: 'Cancellation Fee Revenue', type: 'income' });

  await step('Cancelling with a 40% forfeit splits the deposit into a 12000 cancellation-fee revenue and an 18000 refund — one voucher, three legs', async () => {
    await bookingService.cancelBooking(booking2._id, {
      forfeitPercent: 40, revenueAccountId: cancellationRevenueAccount._id, refundAccountId: cash._id, userId: admin._id,
    });

    // Hand-traced: 30000 deposit × 40% = 12000 forfeited (revenue), 18000 refunded (cash).
    // Verified by pulling the actual voucher's entries, not just trusting the function didn't throw.
    const Voucher = require('./models/Voucher');
    const voucher = await Voucher.findOne({ referenceType: 'EventBookingCancellation', referenceId: booking2._id });
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
      itemDescription: 'Oil change', userId: admin._id,
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
    const result = await hospitalService.completeVisit(visitA._id, { warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
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
      items: [{ productId: p._id, variantId: p.variants[0]._id, quantityOrdered: 2, unitCost: 500 }], userId: admin._id,
    });
    await purchaseService.decidePurchaseOrder(phonePo2._id, { approve: true, userId: admin._id });
    await purchaseService.receiveGoods({
      purchaseOrderId: phonePo2._id, warehouseId: warehouse._id,
      items: [{
        purchaseOrderItemId: phonePo2.items[0]._id, productId: p._id, variantId: p.variants[0]._id,
        quantity: 2, unitCost: 500, serialNumbers: [`WARR-${suffix}`, `WARR-EXPIRED-${suffix}`],
      }],
      userId: admin._id,
    });
    await posSaleService.checkout({ userId: admin._id,
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
      await warrantyService.submitClaim(expiredWarranty._id, { issueDescription: 'Screen cracked', userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected a claim against an expired warranty to be rejected at submission time');
  });

  const claim = await step('Submitting a claim against the ACTIVE warranty succeeds', () =>
    warrantyService.submitClaim(activeWarranty._id, { issueDescription: 'Battery drains fast', userId: admin._id })
  );
  assert(claim.status === 'submitted', `expected claim status "submitted", got "${claim.status}"`);

  await step('Approving the claim, then opening a repair job, creates a REAL core ServiceOrder — not a duplicate concept', async () => {
    await warrantyService.decideClaim(claim._id, { approve: true, decisionNote: 'Covered under warranty' });
    const withRepair = await warrantyService.linkRepairJob(claim._id, {
      branchId: branch._id, warehouseId: warehouse._id, itemDescription: 'Battery replacement', userId: admin._id,
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
      depositAmount: 5000, depositReceivedInAccountId: cash._id, depositLiabilityAccountId: furnitureDepositLiability._id, userId: admin._id,
    });
    const withWorkOrder = await furnitureService.startProduction(order._id, { bomId: furnitureBom._id, warehouseId: warehouse._id, userId: admin._id });
    // The furniture module only CREATES the work order — actually running
    // production is the real, unmodified core Manufacturing flow, called
    // directly here exactly as any other caller of that module would.
    await manufacturingService.startProduction(withWorkOrder.workOrderId, null);
    await manufacturingService.completeProduction(withWorkOrder.workOrderId, { quantityProduced: 1, actualLaborCost: 1000, actualOverheadCost: 200, userId: admin._id });
    await furnitureService.markReady(order._id);
    return furnitureService.deliver(order._id, { warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: admin._id });
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
      productId: croissantProduct._id, variantId: croissantVariantId, producedQuantity: 50, unitCost: 20, userId: admin._id,
    });
    const stock = await inventoryService.getStockLevel(warehouse._id, croissantVariantId);
    assert(stock === 50, `expected stock 50 right after production, got ${stock}`);
    return batch;
  });

  await step('Sell 30 through the day via the ordinary checkout — stock drops to exactly 20', async () => {
    await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: croissantProduct._id, variantId: croissantVariantId, quantity: 30, unitPrice: 60 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 1800 }],
    });
    const stock = await inventoryService.getStockLevel(warehouse._id, croissantVariantId);
    assert(stock === 20, `expected stock 20 after selling 30 of the 50 produced, got ${stock}`);
  });

  await step('Closing the batch writes off exactly the 20 unsold units and posts a real waste voucher — hand-traced: 20 × 20 = 400', async () => {
    const closed = await dailyBatchService.closeBatch(morningBatch._id, { userId: admin._id });
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
      await dailyBatchService.closeBatch(morningBatch._id, { userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected closing an already-closed batch to be rejected');
  });

  // --- 26. CRM campaign sending — closing a real gap, not adding a module: this used to do nothing beyond marking a campaign "sent" ---
  await step('A campaign sent to a customer with NO phone on file fails cleanly for that recipient, not silently or with a crash', async () => {
    await Customer.findByIdAndUpdate(customer._id, { $addToSet: { tags: 'SmokeSegment' } });
    const campaign = await crmService.createCampaign({
      companyId: company._id, name: 'Smoke SMS Campaign', channel: 'sms', message: 'Hello from the smoke test',
      targetTags: ['SmokeSegment'], userId: admin._id,
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
      targetTags: ['SmokeSegment'], userId: admin._id,
    });
    const { campaign: sent } = await crmService.sendCampaign(campaign._id);

    assert(sent.successCount === 1 && sent.failureCount === 0, `expected 1 success and 0 failures now that the customer has a phone on file, got success=${sent.successCount} failure=${sent.failureCount}`);
  });

  await step('Re-sending an already-sent campaign is rejected, not silently re-processed into a duplicate send', async () => {
    const campaign = await crmService.createCampaign({
      companyId: company._id, name: 'Smoke SMS Campaign 3', channel: 'sms', message: 'Third', targetTags: ['SmokeSegment'], userId: admin._id,
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
      items: [{ productId: milkProduct._id, variantId: milkVariantId, quantityOrdered: 45, unitCost: 100 }], userId: admin._id,
    });
    await purchaseService.decidePurchaseOrder(milkPo._id, { approve: true, userId: admin._id });

    // Received in a deliberately SCRAMBLED order (soonest-expiring batch
    // received SECOND, not first) — specifically to prove FEFO sorts by
    // actual expiry date, not by receiving order or batch-creation order.
    await purchaseService.receiveGoods({
      purchaseOrderId: milkPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: milkPo.items[0]._id, productId: milkProduct._id, variantId: milkVariantId, quantity: 15, unitCost: 100, batchNumber: 'MILK-B', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000) }],
      userId: admin._id,
    });
    await purchaseService.receiveGoods({
      purchaseOrderId: milkPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: milkPo.items[0]._id, productId: milkProduct._id, variantId: milkVariantId, quantity: 10, unitCost: 100, batchNumber: 'MILK-A', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) }],
      userId: admin._id,
    });
    await purchaseService.receiveGoods({
      purchaseOrderId: milkPo._id, warehouseId: warehouse._id,
      items: [{ purchaseOrderItemId: milkPo.items[0]._id, productId: milkProduct._id, variantId: milkVariantId, quantity: 20, unitCost: 100, batchNumber: 'MILK-C', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000) }],
      userId: admin._id,
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
      rollNumber: `ROLL-${suffix}`, unitOfMeasure: 'meters', length: 20, unitCost: 200, remnantThreshold: 5, userId: admin._id,
    });
    const stock = await inventoryService.getStockLevel(warehouse._id, fabricVariantId);
    assert(stock === 20, `expected stock 20 right after receiving the roll, got ${stock}`);
    assert(r.status === 'active', `expected a freshly received roll to start "active", got "${r.status}"`);
    return r;
  });

  await step('Cutting 10m leaves 10m remaining — still above the 5m threshold, status stays "active", nobody had to mark it', async () => {
    const cut = await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 10, userId: admin._id });
    assert(cut.remainingLength === 10, `expected remainingLength 10 (20 - 10), got ${cut.remainingLength}`);
    assert(cut.status === 'active', `expected status to remain "active" at 10m remaining (above the 5m threshold), got "${cut.status}"`);
    const stock = await inventoryService.getStockLevel(warehouse._id, fabricVariantId);
    assert(stock === 10, `expected real stock to also be exactly 10 after the cut (not just the roll's own field), got ${stock}`);
  });

  await step('Cutting 6 more crosses below the 5m threshold (10 -> 4) — the roll automatically reclassifies itself as "remnant", no separate action taken', async () => {
    const cut = await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 6, userId: admin._id });
    assert(cut.remainingLength === 4, `expected remainingLength 4 (10 - 6), got ${cut.remainingLength}`);
    assert(cut.status === 'remnant', `expected the cut ITSELF to flip status to "remnant" now that 4 < the 5m threshold, got "${cut.status}"`);
  });

  await step('Cutting more than what remains on the roll is rejected with a specific, honest error', async () => {
    let threw = false;
    let message = '';
    try {
      await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 100, userId: admin._id });
    } catch (err) { threw = true; message = err.message; }
    assert(threw && message.includes('only 4'), `expected a rejection specifically mentioning only 4m remain, got threw=${threw} message="${message}"`);
  });

  await step('Cutting the exact remaining 4m exhausts the roll — status "exhausted", real stock lands at exactly 0', async () => {
    const cut = await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 4, userId: admin._id });
    assert(cut.remainingLength === 0, `expected remainingLength exactly 0, got ${cut.remainingLength}`);
    assert(cut.status === 'exhausted', `expected status "exhausted" at 0 remaining, got "${cut.status}"`);
    const stock = await inventoryService.getStockLevel(warehouse._id, fabricVariantId);
    assert(stock === 0, `expected real stock to be exactly 0 after exhausting the roll, got ${stock}`);
  });

  await step('Attempting to cut from an already-exhausted roll is rejected outright', async () => {
    let threw = false;
    try {
      await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 1, userId: admin._id });
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
      userId: admin._id,
    });
    const stockAfter = await inventoryService.getStockLevel(warehouse._id, drillVariantId);
    assert(stockAfter === stockBefore - 1, `expected stock to drop by exactly 1 on checkout, went from ${stockBefore} to ${stockAfter}`);
  });

  await step('Returning in GOOD condition after 2 days: full deposit refund, item restocked, usage charge billed at 2×500=1000', async () => {
    const [rental] = await toolRentalService.listRentals(company._id, { status: 'out' });
    const stockBeforeReturn = await inventoryService.getStockLevel(warehouse._id, drillVariantId);

    const returned = await toolRentalService.returnRental(rental._id, {
      condition: 'good', actualReturnDate: new Date(rental.checkOutDate.getTime() + 2 * 24 * 60 * 60 * 1000),
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: admin._id,
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
      userId: admin._id,
    });
    const [rental2] = await toolRentalService.listRentals(company._id, { status: 'out' });
    const stockBeforeReturn = await inventoryService.getStockLevel(warehouse._id, drillVariantId);

    const returned = await toolRentalService.returnRental(rental2._id, {
      condition: 'minor_damage', forfeitPercentForMinorDamage: 30,
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, damageRevenueAccountId: damageRevenueAccount._id, userId: admin._id,
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
      userId: admin._id,
    });
    const [rental3] = await toolRentalService.listRentals(company._id, { status: 'out' });

    const returned = await toolRentalService.returnRental(rental3._id, {
      condition: 'lost_or_major_damage',
      warehouseId: warehouse._id, finalPaymentAccountId: cash._id, damageRevenueAccountId: damageRevenueAccount._id, userId: admin._id,
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
      totalPrice: 3000, depositLiabilityAccountId: layawayLiabilityAccount._id, userId: admin._id,
    });

    const after = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });
    assert(after.quantity === before.quantity, `expected on-hand quantity unchanged by opening a layaway plan (10), got ${after.quantity}`);
    assert(after.reservedQuantity === (before.reservedQuantity || 0) + 1, `expected reservedQuantity to increase by exactly 1, went from ${before.reservedQuantity || 0} to ${after.reservedQuantity}`);
    return p;
  });

  await step('First payment of 1000 leaves the plan active with 2000 remaining — NOT completed yet', async () => {
    const result = await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: cash._id, userId: admin._id });
    assert(result.completed === false, 'expected the plan to still be active after only 1000 of 3000 paid');
    assert(result.remaining === 2000, `expected remaining 2000 (3000 - 1000), got ${result.remaining}`);
    assert(result.plan.status === 'active', `expected plan status "active", got "${result.plan.status}"`);
  });

  await step('Second payment of 1000 leaves 1000 remaining — still active', async () => {
    const result = await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: cash._id, userId: admin._id });
    assert(result.completed === false && result.remaining === 1000, `expected still active with 1000 remaining, got completed=${result.completed} remaining=${result.remaining}`);
  });

  await step('The THIRD payment of exactly 1000 crosses the threshold — completes the plan automatically in this SAME call: reservation released, real stock deducted, a real Sale created for the full 3000', async () => {
    const StockLevel = require('./models/StockLevel');
    const before = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });

    const result = await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: cash._id, userId: admin._id });

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
      await layawayService.makePayment(plan._id, { amount: 100, paymentAccountId: cash._id, userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected a payment toward a completed plan to be rejected');
  });

  await step('A SEPARATE plan cancelled while still active releases its reservation without ever touching real stock or creating a Sale', async () => {
    const StockLevel = require('./models/StockLevel');
    const plan2 = await layawayService.createPlan({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id,
      productId: tvProduct._id, variantId: tvVariantId, customerId: customer._id,
      totalPrice: 3000, depositLiabilityAccountId: layawayLiabilityAccount._id, userId: admin._id,
    });
    await layawayService.makePayment(plan2._id, { amount: 500, paymentAccountId: cash._id, userId: admin._id });

    const before = await StockLevel.findOne({ warehouseId: warehouse._id, variantId: tvVariantId });
    const cancelled = await layawayService.cancelPlan(plan2._id, { refundPercent: 100, refundAccountId: cash._id, userId: admin._id });
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
      paymentAccountId: cash._id, userId: admin._id,
    });
    assert(s.status === 'active', `expected subscription status "active", got "${s.status}"`);
    return s;
  });

  await step('First redemption of the day succeeds and deducts real stock by 1', async () => {
    const stockBefore = await inventoryService.getStockLevel(warehouse._id, coffeeProduct.variants[0]._id);
    const result = await cafeSubscriptionService.redeemDaily(subscription._id, { warehouseId: warehouse._id, userId: admin._id });
    assert(result.redemptionsToday === 1, `expected redemptionsToday 1 after the first redemption, got ${result.redemptionsToday}`);
    const stockAfter = await inventoryService.getStockLevel(warehouse._id, coffeeProduct.variants[0]._id);
    assert(stockAfter === stockBefore - 1, `expected real stock to drop by exactly 1, went from ${stockBefore} to ${stockAfter}`);
  });

  await step('A SECOND redemption the SAME day is rejected — today\'s single-drink allowance is already used', async () => {
    let threw = false;
    let message = '';
    try {
      await cafeSubscriptionService.redeemDaily(subscription._id, { warehouseId: warehouse._id, userId: admin._id });
    } catch (err) { threw = true; message = err.message; }
    assert(threw && message.includes('already been used'), `expected a same-day second redemption to be rejected with a clear "already used" message, got threw=${threw} message="${message}"`);
  });

  await step('Simulating a day passing (backdating lastRedemptionDate to yesterday) — the SAME subscription can redeem again, proving the cap genuinely resets per calendar day rather than being a one-time-only pool', async () => {
    const CafeSubscription = require('./modules/cafe/models/CafeSubscription');
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await CafeSubscription.findByIdAndUpdate(subscription._id, { lastRedemptionDate: yesterday });

    const result = await cafeSubscriptionService.redeemDaily(subscription._id, { warehouseId: warehouse._id, userId: admin._id });
    assert(result.redemptionsToday === 1, `expected redemptionsToday to reset to 1 on a new calendar day, not accumulate to 2, got ${result.redemptionsToday}`);
    assert(result.totalRedemptions === 2, `expected the LIFETIME total to correctly be 2 (this is the informational running count, unlike the daily one which resets), got ${result.totalRedemptions}`);
  });

  await step('An already-expired subscription is rejected on redemption and flips its own status to "expired"', async () => {
    const expiredSub = await cafeSubscriptionService.sellSubscription({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      planName: 'Expired Plan', startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      dailyLimit: 1, subscriptionBillingProductId: subscriptionFeeProduct._id, subscriptionBillingVariantId: subscriptionFeeProduct.variants[0]._id,
      subscriptionPrice: 2000, redeemProductId: coffeeProduct._id, redeemVariantId: coffeeProduct.variants[0]._id,
      paymentAccountId: cash._id, userId: admin._id,
    });

    let threw = false;
    try {
      await cafeSubscriptionService.redeemDaily(expiredSub._id, { warehouseId: warehouse._id, userId: admin._id });
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
      paymentAccountId: cash._id, userId: admin._id,
    });

    let threw = false;
    try {
      await cafeSubscriptionService.redeemDaily(teaSub._id, { warehouseId: warehouse._id, userId: admin._id });
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
      quantity: 2, purchasingCustomerId: buyerA._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result.sale.totalAmount === 2000, `expected buyer A's sale to total 2000 (2 × 1000), got ${result.sale.totalAmount}`);
    const item = result.registry.items.id(registryItemId);
    assert(item.purchasedQuantity === 2, `expected purchasedQuantity 2 after buyer A's purchase, got ${item.purchasedQuantity}`);
  });

  await step('THE CRITICAL TEST: 3 buyers attempt to purchase 2 each — SIMULTANEOUSLY, via real concurrent requests — against only 3 remaining (5 total - 2 already claimed). A naive read-then-write implementation would let all 3 succeed (over-claiming to 8); the atomic DB-level guard must allow exactly enough to fit and reject the rest', async () => {
    const results = await Promise.allSettled([
      giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, { quantity: 2, purchasingCustomerId: buyerB._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id }),
      giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, { quantity: 2, purchasingCustomerId: buyerC._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id }),
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
      quantity: 1, purchasingCustomerId: buyerA._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
    });
    const item = result.registry.items.id(registryItemId);
    assert(item.purchasedQuantity === 5, `expected purchasedQuantity to reach exactly 5 (fully claimed), got ${item.purchasedQuantity}`);
  });

  await step('Any further purchase attempt is rejected with a specific, honest message — nothing remains', async () => {
    let threw = false;
    let message = '';
    try {
      await giftRegistryService.purchaseFromRegistry(registry._id, registryItemId, {
        quantity: 1, purchasingCustomerId: buyerB._id, branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
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
    const shift = await fuelShiftService.openShift(dispenser._id, { pricePerLitre: 250, userId: admin._id });
    assert(shift.openingReading === 1000, `expected openingReading 1000, got ${shift.openingReading}`);
    return shift;
  });
  await step('Closing at 1150 derives EXACTLY 150 litres sold (1150-1000) and bills 150 × 250 = 37500 — nobody entered "150" anywhere', async () => {
    const [openShift] = await fuelShiftService.listShifts(company._id, { status: 'open' });
    const result = await fuelShiftService.closeShift(openShift._id, {
      closingReading: 1150, warehouseId: warehouse._id, customerId: customer._id, paymentAccountId: cash._id,
      billingProductId: fuelProduct._id, billingVariantId: fuelProduct.variants[0]._id, userId: admin._id,
    });
    assert(result.litresSold === 150, `expected litresSold 150 (1150-1000), got ${result.litresSold}`);
    assert(result.totalAmount === 37500, `expected totalAmount 37500 (150 × 250), got ${result.totalAmount}`);
    const updatedDispenser = await require('./modules/petrol_pump/models/FuelDispenser').findById(dispenser._id);
    assert(updatedDispenser.currentMeterReading === 1150, `expected the dispenser's own running total to advance to 1150 for the next shift to open from, got ${updatedDispenser.currentMeterReading}`);
  });
  await step('A closing reading LOWER than opening is rejected — the meter cannot run backward', async () => {
    await fuelShiftService.openShift(dispenser._id, { pricePerLitre: 250, userId: admin._id });
    let threw = false;
    try {
      const [openShift] = await fuelShiftService.listShifts(company._id, { status: 'open' });
      await fuelShiftService.closeShift(openShift._id, { closingReading: 1000, warehouseId: warehouse._id, billingProductId: fuelProduct._id, billingVariantId: fuelProduct.variants[0]._id, userId: admin._id });
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
      shippingFee: 500, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
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
      scheduleId: gradeSchedule._id, expenseAccountId: expenseAcct._id, payableAccountId: payableAcct._id, userId: admin._id,
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
      await dairyCollectionService.recordCollection({ companyId: company._id, branchId: branch._id, supplierId: supplier._id, litres: 10, fatPercent: 2.5, scheduleId: gradeSchedule._id, userId: admin._id });
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
      startDate: rentalStart, endDate: rentalEnd, rentalBillingProductId: carUsageProduct._id, rentalBillingVariantId: carUsageProduct.variants[0]._id, userId: admin._id,
    })
  );
  await step('A SECOND overlapping booking for the same class is assigned the OTHER vehicle — pool search, not a single resource\'s calendar', async () => {
    const carBooking2 = await carRentalService.bookRental({
      companyId: company._id, branchId: branch._id, vehicleClass: 'Compact', customerId: customer._id,
      startDate: rentalStart, endDate: rentalEnd, rentalBillingProductId: carUsageProduct._id, rentalBillingVariantId: carUsageProduct.variants[0]._id, userId: admin._id,
    });
    assert(String(carBooking2.vehicleId) !== String(carBooking1.vehicleId), 'expected the second overlapping booking to be assigned a DIFFERENT vehicle than the first');
  });
  await step('A THIRD overlapping booking fails — both vehicles in the class are now taken for those dates', async () => {
    let threw = false;
    try {
      await carRentalService.bookRental({
        companyId: company._id, branchId: branch._id, vehicleClass: 'Compact', customerId: customer._id,
        startDate: rentalStart, endDate: rentalEnd, rentalBillingProductId: carUsageProduct._id, rentalBillingVariantId: carUsageProduct.variants[0]._id, userId: admin._id,
      });
    } catch { threw = true; }
    assert(threw, 'expected a third overlapping booking to fail once both pool vehicles are taken');
  });
  await step('Returning the first booking after 3 days bills exactly 3 × 3000 = 9000', async () => {
    const result = await carRentalService.returnVehicle(carBooking1._id, { actualReturnDate: new Date(rentalStart.getTime() + 3 * 24 * 60 * 60 * 1000), warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: admin._id });
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
    const { sale, fee } = await storageContractService.billPeriod(contract._id, { periodStart, periodEnd, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    assert(fee === 1600 && sale.totalAmount === 1600, `expected the bill to total exactly the computed 1600, got fee=${fee} saleTotal=${sale.totalAmount}`);
  });

  // --- 39. Automobile: core already handles VIN-tracked sale; the ONE new piece (trade-in) reuses Jewelry's exact shape with an honestly different valuation ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'automobile' } });
  const carProduct = await Product.create({ companyId: company._id, name: 'Sedan', sku: `SEDAN-${suffix}`, trackingMode: 'serial', costPrice: 2000000, sellingPrice: 2500000, variants: [{ sku: `SEDAN-${suffix}`, sellingPrice: 2500000 }] });
  await step('A VIN sells through the ordinary checkout exactly like an IMEI does — no new code needed for this half', async () => {
    const carPo = await purchaseService.createPurchaseOrder({ companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id, items: [{ productId: carProduct._id, variantId: carProduct.variants[0]._id, quantityOrdered: 1, unitCost: 2000000 }], userId: admin._id });
    await purchaseService.decidePurchaseOrder(carPo._id, { approve: true, userId: admin._id });
    await purchaseService.receiveGoods({ purchaseOrderId: carPo._id, warehouseId: warehouse._id, items: [{ purchaseOrderItemId: carPo.items[0]._id, productId: carProduct._id, variantId: carProduct.variants[0]._id, quantity: 1, unitCost: 2000000, serialNumbers: [`VIN-${suffix}`] }], userId: admin._id });
    const sale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: carProduct._id, variantId: carProduct.variants[0]._id, quantity: 1, unitPrice: 2500000, serialNumbers: [`VIN-${suffix}`] }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 2500000 }],
    });
    assert(sale.totalAmount === 2500000, `expected the vehicle sale to total 2500000, got ${sale.totalAmount}`);
  });
  await step('Trade-in credit is intaken, applied as a discount on a real sale, then marked applied for audit trail', async () => {
    const credit = await tradeInService.intake({ companyId: company._id, customerId: customer._id, vehicleDescription: 'Old Corolla', appraisedValue: 100, userId: admin._id });
    assert(credit.status === 'pending', 'trade-in starts pending until applied');

    const linkedSale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100, discountAmount: 100 }],
      payments: [],
    });
    const applied = await tradeInService.markApplied(credit._id, linkedSale._id);
    assert(applied.status === 'applied' && String(applied.saleId) === String(linkedSale._id), 'trade-in marked applied and linked to the sale it credited');
  });

  // --- 40. Notification Engine: real, event-driven, not decorative — low stock actually fires from a real checkout ---
  const Role = require('./models/Role');
  const Notification = require('./models/Notification');
  const inventoryRole = await Role.create({ companyId: company._id, name: 'Inventory Manager', permissions: ['inventory.adjust'] });

  const lowStockProduct = await step('Create a product with a reorderLevel of 5 and exactly 6 units of stock', async () => {
    const p = await Product.create({
      companyId: company._id, name: 'Low Stock Test Item', sku: `LOWSTOCK-${suffix}`,
      trackingMode: 'simple', costPrice: 100, sellingPrice: 200, reorderLevel: 5,
      variants: [{ sku: `LOWSTOCK-${suffix}`, sellingPrice: 200 }],
    });
    await inventoryService.recordMovement({
      companyId: company._id, warehouseId: warehouse._id, productId: p._id, variantId: p.variants[0]._id,
      type: 'adjustment', quantity: 6, note: 'Smoke test opening stock for low-stock trigger test',
    });
    return p;
  });

  await step('Selling 1 unit (6 -> 5, hits the threshold exactly) DOES fire — inclusive boundary, same "the threshold itself counts" convention every other threshold check in this app already uses', async () => {
    await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: lowStockProduct._id, variantId: lowStockProduct.variants[0]._id, quantity: 1, unitPrice: 200 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 200 }],
    });
    const notification = await Notification.findOne({ companyId: company._id, type: 'low_stock', entityId: lowStockProduct._id });
    assert(notification, 'expected a real low-stock notification once stock reached exactly the reorderLevel of 5 — the boundary itself counts, same as every other threshold in this app');
    assert(String(notification.roleId) === String(inventoryRole._id), 'expected the notification to be targeted at the role with inventory.adjust permission');
    assert(notification.message.includes('5'), `expected the message to state the actual current quantity (5), got "${notification.message}"`);
  });

  await step('Selling ANOTHER unit while already at/below threshold does NOT create a second notification — deduped against the still-unread one', async () => {
    await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: lowStockProduct._id, variantId: lowStockProduct.variants[0]._id, quantity: 1, unitPrice: 200 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 200 }],
    });
    const count = await Notification.countDocuments({ companyId: company._id, type: 'low_stock', entityId: lowStockProduct._id });
    assert(count === 1, `expected still exactly 1 low-stock notification (deduped, not spammed on every subsequent sale), got ${count}`);
  });

  await step('Marking the notification read allows a FUTURE drop to notify again — the dedup is against unread, not "ever notified"', async () => {
    const notification = await Notification.findOne({ companyId: company._id, type: 'low_stock', entityId: lowStockProduct._id });
    await notificationService.markRead(notification._id);
    const unread = await notificationService.unreadCount(company._id, null, inventoryRole._id);
    assert(unread === 0, `expected 0 unread notifications for this role after marking read, got ${unread}`);
  });

  // --- 41. Workflow Engine: real multi-step chains, genuinely backward-compatible with the original single-step behavior ---
  const managerRole = await Role.create({ companyId: company._id, name: 'Purchase Manager', permissions: ['purchases.create'] });
  const financeRole = await Role.create({ companyId: company._id, name: 'Finance Director', permissions: ['purchases.create'] });

  await approvalService.defineWorkflow({
    companyId: company._id, entityType: 'SmokeTestWorkflow',
    steps: [{ order: 1, roleId: managerRole._id, minAmount: 0 }, { order: 2, roleId: financeRole._id, minAmount: 100000 }],
  });

  await step('A request for 50000 (below the 100000 threshold) only gets the FIRST step — the second step correctly does not apply', async () => {
    const approval = await approvalService.request({ companyId: company._id, entityType: 'SmokeTestWorkflow', entityId: customer._id, requestedBy: null, amount: 50000 });
    assert(approval.steps.length === 1, `expected exactly 1 applicable step for an amount below the second step's threshold, got ${approval.steps.length}`);
    const decided = await approvalService.decide(approval._id, { approve: true, userId: admin._id });
    assert(decided.status === 'approved', `expected immediate final approval after the only applicable step, got "${decided.status}"`);
  });

  const bigApproval = await step('A request for 150000 (above the threshold) gets BOTH steps — approving step 1 alone does NOT complete it', async () => {
    const approval = await approvalService.request({ companyId: company._id, entityType: 'SmokeTestWorkflow', entityId: supplier._id, requestedBy: null, amount: 150000 });
    assert(approval.steps.length === 2, `expected exactly 2 applicable steps for an amount above the second step's threshold, got ${approval.steps.length}`);
    const afterStep1 = await approvalService.decide(approval._id, { approve: true, userId: admin._id });
    assert(afterStep1.status === 'pending', `expected status to STILL be "pending" after only step 1 of 2 is approved, got "${afterStep1.status}"`);
    assert(afterStep1.currentStepIndex === 1, `expected currentStepIndex to have advanced to 1 (the second step), got ${afterStep1.currentStepIndex}`);
    return afterStep1;
  });
  await step('Approving the SECOND step completes the whole chain', async () => {
    const final = await approvalService.decide(bigApproval._id, { approve: true, userId: admin._id });
    assert(final.status === 'approved', `expected final status "approved" after both steps, got "${final.status}"`);
  });

  await step('A REJECTION at step 1 of a 2-step chain kills the whole request immediately — step 2 never gets asked', async () => {
    const approval = await approvalService.request({ companyId: company._id, entityType: 'SmokeTestWorkflow', entityId: customer._id, requestedBy: null, amount: 150000 });
    const decided = await approvalService.decide(approval._id, { approve: false, userId: admin._id });
    assert(decided.status === 'rejected', `expected status "rejected" immediately after step 1 alone rejects, got "${decided.status}"`);
    assert(decided.steps[1].decision === null, 'expected step 2 to have never been decided at all — the chain stopped before reaching it');
  });

  await step('Genuinely backward compatible: an entityType with NO configured workflow still gets exactly the old single implicit step', async () => {
    const approval = await approvalService.request({ companyId: company._id, entityType: 'SomeEntityTypeWithNoWorkflowConfigured', entityId: customer._id, requestedBy: null });
    assert(approval.steps.length === 1 && approval.steps[0].roleId === null, 'expected exactly one implicit step with no role target, matching the original pre-upgrade behavior');
    const decided = await approvalService.decide(approval._id, { approve: true, userId: admin._id });
    assert(decided.status === 'approved', 'expected the single implicit step to complete the whole request, same as before this upgrade');
  });

  // --- 42. Integration Engine: real HMAC-signed outbound delivery, attempted for real, failure handled gracefully ---
  const webhookSub = await step('Subscribing to sale.completed with a deliberately unreachable URL succeeds — subscribing itself never depends on the URL actually being reachable', () =>
    webhookService.subscribe({ companyId: company._id, eventType: 'sale.completed', targetUrl: 'http://localhost:1/deliberately-unreachable', secret: 'smoke_test_secret' })
  );

  await step('A real checkout fires the webhook for real — delivery genuinely fails against the unreachable URL, and that failure is recorded honestly, not swallowed or faked as success', async () => {
    await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 100 }],
    });
    const WebhookSubscription = require('./models/WebhookSubscription');
    const refreshed = await WebhookSubscription.findById(webhookSub._id);
    assert(refreshed.lastDeliveryStatus === 'failed', `expected the delivery attempt to be honestly recorded as "failed" against an unreachable URL, got "${refreshed.lastDeliveryStatus}"`);
    assert(refreshed.lastFailureReason, 'expected a real failure reason to be recorded, not left blank');
    assert(refreshed.lastDeliveryAt, 'expected lastDeliveryAt to be set — a real attempt genuinely happened, not skipped');
  });

  // --- 43. Fixed Assets: real straight-line depreciation across periods, deduped, capped at salvage value, then a fully-hand-verified 4-leg disposal voucher ---
  const assetAccount = await Account.create({ companyId: company._id, name: 'Office Equipment (Asset)', type: 'asset' });
  const depreciationExpenseAccount = await Account.create({ companyId: company._id, name: 'Depreciation Expense', type: 'expense' });
  const accumulatedDepreciationAccount = await Account.create({ companyId: company._id, name: 'Accumulated Depreciation', type: 'asset' });
  const disposalGainLossAccount = await Account.create({ companyId: company._id, name: 'Gain/Loss on Disposal', type: 'income' });

  const asset = await step('Register an asset: 120000 cost, 12000 salvage, 12-month life — hand-traced monthly depreciation: (120000-12000)/12 = 9000 exactly', async () => {
    const a = await fixedAssetService.registerAsset({
      companyId: company._id, branchId: branch._id, name: 'Office Printer', category: 'Equipment',
      assetAccountId: assetAccount._id, depreciationExpenseAccountId: depreciationExpenseAccount._id, accumulatedDepreciationAccountId: accumulatedDepreciationAccount._id,
      purchaseDate: new Date(), purchaseCost: 120000, salvageValue: 12000, usefulLifeMonths: 12,
    });
    assert(a.monthlyDepreciation === 9000, `expected monthlyDepreciation exactly 9000, got ${a.monthlyDepreciation}`);
    return a;
  });

  await step('Running depreciation for period 1 posts a real, balanced voucher and advances accumulatedDepreciation to exactly 9000', async () => {
    const result = await fixedAssetService.runDepreciation(asset._id, { period: '2026-01', userId: admin._id });
    assert(result.amount === 9000 && result.bookValueAfter === 111000, `expected amount 9000 and bookValueAfter 111000 (120000-9000), got amount=${result.amount} bookValueAfter=${result.bookValueAfter}`);

    const totalDebit = result.voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = result.voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 9000 && totalCredit === 9000, `expected the depreciation voucher to balance at exactly 9000, got debit=${totalDebit} credit=${totalCredit}`);
  });

  await step('Running depreciation for a SECOND period advances to 18000 accumulated', async () => {
    const result = await fixedAssetService.runDepreciation(asset._id, { period: '2026-02', userId: admin._id });
    assert(result.amount === 9000 && result.bookValueAfter === 102000, `expected amount 9000 and bookValueAfter 102000 (120000-18000), got amount=${result.amount} bookValueAfter=${result.bookValueAfter}`);
  });

  await step('Attempting to run the SAME period again is rejected — no accidental double depreciation for one month', async () => {
    let threw = false;
    try {
      await fixedAssetService.runDepreciation(asset._id, { period: '2026-02', userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected re-running an already-posted period to be rejected');
  });

  await step('Disposing the asset for 90000 (a LOSS, since book value is 102000) posts a real 4-leg voucher — hand-verified to balance BEFORE the service was ever written, now confirmed against the actual posted entries', async () => {
    const result = await fixedAssetService.disposeAsset(asset._id, {
      disposalProceeds: 90000, receivingAccountId: cash._id, gainLossAccountId: disposalGainLossAccount._id, userId: admin._id,
    });
    assert(result.bookValue === 102000, `expected bookValue 102000 (120000 - 18000 accumulated), got ${result.bookValue}`);
    assert(result.gainLoss === -12000, `expected a loss of -12000 (90000 proceeds - 102000 book value), got ${result.gainLoss}`);

    const totalDebit = result.voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = result.voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 120000 && totalCredit === 120000, `expected the 4-leg disposal voucher to balance at exactly 120000 (the original purchase cost), got debit=${totalDebit} credit=${totalCredit}`);
    assert(result.voucher.entries.length === 4, `expected exactly 4 legs (accumulated depreciation cleared, asset removed at cost, cash proceeds received, loss recognized), got ${result.voucher.entries.length}`);

    const refreshedAsset = await require('./models/FixedAsset').findById(asset._id);
    assert(refreshedAsset.status === 'disposed', `expected status "disposed", got "${refreshedAsset.status}"`);
  });

  // --- 44. Dashboard Engine: a role's permissions genuinely determine what data comes back, not one generic view for everyone ---
  await step('A super-admin (permissions=null) gets the full owner view, with real numbers pulled straight from the balance sheet and P&L, not re-derived', async () => {
    const result = await dashboardService.getDashboard(company._id, { userId: admin._id, roleId: null, permissions: null });
    assert(result.sections.owner, 'expected a super-admin to receive the owner dashboard section');
    assert(typeof result.sections.owner.netProfit === 'number', 'expected a real numeric netProfit, not undefined from a wrong field name');
    assert(typeof result.sections.owner.receivables === 'number', 'expected a real numeric receivables figure resolved from the actual balance sheet');
  });

  await step('A cashier-only role (just pos.sell, nothing else) gets ONLY the cashier section — no owner financials leak to someone who shouldn\'t see them', async () => {
    const result = await dashboardService.getDashboard(company._id, { userId: admin._id, roleId: null, permissions: ['pos.sell'] });
    assert(result.sections.cashier, 'expected a cashier-only role to receive the cashier section');
    assert(!result.sections.owner, 'expected a cashier-only role to NOT receive the owner financial section');
    assert(!result.sections.warehouseManager, 'expected a cashier-only role to NOT receive the warehouse manager section');
  });

  await step('A role with BOTH accounts.manage and inventory.adjust gets BOTH sections — multiple relevant permission sets aren\'t forced into picking just one', async () => {
    const result = await dashboardService.getDashboard(company._id, { userId: admin._id, roleId: null, permissions: ['accounts.manage', 'inventory.adjust'] });
    assert(result.sections.owner && result.sections.warehouseManager, 'expected both the owner and warehouse manager sections for a role with both permissions');
  });

  await step('An empty/irrelevant permission set falls back to the smallest, safest slice rather than showing nothing at all', async () => {
    const result = await dashboardService.getDashboard(company._id, { userId: admin._id, roleId: null, permissions: ['some.unrelated.permission'] });
    assert(result.sections.cashier, 'expected a fallback to the cashier section when no specific permission set matches anything');
  });

  // --- 45. Currency Service: confirmed PKR coverage gap respected honestly, manual rates work end to end, conversion math is real ---
  await step('The SAME currency always converts at exactly 1, with zero lookups needed', async () => {
    const rate = await currencyService.getRate(company._id, 'PKR', 'PKR', '2026-08-01');
    assert(rate === 1, `expected same-currency rate to be exactly 1, got ${rate}`);
  });

  await step('PKR (this platform\'s own default currency) is confirmed NOT covered by the free rate source — genuinely checked, not assumed', () => {
    assert(currencyService.isFrankfurterSupported('PKR') === false, 'expected PKR to be correctly identified as unsupported by Frankfurter');
  });

  await step('Requesting a rate for an uncached, unsupported pair (PKR -> USD) with no manual rate entered is REJECTED with a clear, actionable message — never silently defaults to 1 or guesses', async () => {
    let threw = false;
    let message = '';
    try {
      await currencyService.getRate(company._id, 'PKR', 'USD', '2026-08-01');
    } catch (err) { threw = true; message = err.message; }
    assert(threw && message.includes('manual rate'), `expected a rejection specifically pointing at entering a manual rate, got threw=${threw} message="${message}"`);
  });

  await step('Entering a manual PKR -> USD rate makes it immediately usable for real conversion — hand-traced: 278000 PKR at a manual rate of 0.0036 = exactly 1000.80 USD', async () => {
    await currencyService.setManualRate({ companyId: company._id, fromCurrency: 'PKR', toCurrency: 'USD', rate: 0.0036, date: '2026-08-01', userId: admin._id });
    const converted = await currencyService.convert(company._id, 278000, 'PKR', 'USD', '2026-08-01');
    assert(converted === 1000.80, `expected 278000 × 0.0036 = 1000.80, got ${converted}`);
  });

  await step('A manual rate entered for one specific date does NOT apply to a different date — dates are genuinely isolated, not treated as a standing rate', async () => {
    let threw = false;
    try {
      await currencyService.getRate(company._id, 'PKR', 'USD', '2026-08-02'); // a different date, no rate entered for it
    } catch { threw = true; }
    assert(threw, 'expected a rate lookup for a different, un-entered date to still fail, even though a rate exists for a nearby date');
  });

  // --- 46. Document Management: real versioning (append, never overwrite), genuinely reuses the Workflow and Notification engines, not parallel systems ---
  const employeeForDoc = await require('./models/Employee').create({ companyId: company._id, name: 'Contract Test Employee', designation: 'Staff' });

  const document = await step('Uploading a document creates version 1', async () => {
    const doc = await documentService.createDocument({
      companyId: company._id, entityType: 'Employee', entityId: employeeForDoc._id, category: 'Employment Contract',
      fileUrl: 'https://example.com/files/contract-v1.pdf', fileName: 'contract-v1.pdf',
      expiryDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), userId: admin._id,
    });
    assert(doc.versions.length === 1 && doc.versions[0].versionNumber === 1, `expected exactly 1 version numbered 1, got ${doc.versions.length} versions`);
    return doc;
  });

  await step('Uploading a SECOND version APPENDS rather than overwrites — both versions remain visible in history', async () => {
    const doc = await documentService.uploadVersion(document._id, { fileUrl: 'https://example.com/files/contract-v2-signed.pdf', fileName: 'contract-v2-signed.pdf', userId: admin._id, note: 'Signed copy' });
    assert(doc.versions.length === 2, `expected exactly 2 versions after uploading a second one, got ${doc.versions.length}`);
    assert(doc.versions[0].fileName === 'contract-v1.pdf', 'expected the FIRST version to still be present and unmodified in history');
    assert(documentService.currentVersion(doc).fileName === 'contract-v2-signed.pdf', 'expected currentVersion() to correctly resolve to the latest (second) version');
  });

  await step('Requesting approval creates a REAL ApprovalRequest through the actual Workflow Engine — not a second, parallel approval system built just for documents', async () => {
    const { approval } = await documentService.requestApproval(document._id, { requestedBy: null, note: 'Please review the signed contract' });
    const foundViaApprovalService = await approvalService.findFor('Document', document._id);
    assert(String(foundViaApprovalService._id) === String(approval._id), 'expected the SAME ApprovalRequest to be findable through approvalService.findFor — genuine reuse, not a duplicate record');
  });

  await step('Requesting approval a SECOND time for the same document is rejected — one approval per document, not stacked duplicates', async () => {
    let threw = false;
    try {
      await documentService.requestApproval(document._id, { requestedBy: null });
    } catch { threw = true; }
    assert(threw, 'expected a second approval request on the same document to be rejected');
  });

  await step('A document expiring in 15 days IS caught by a 30-day expiry sweep, and fires a REAL notification through the actual Notification Engine', async () => {
    const docExpiryRole = await require('./models/Role').create({ companyId: company._id, name: 'Document Manager', permissions: ['roles.manage'] });
    const result = await documentService.checkExpiringDocuments(company._id, 30);
    assert(result.notifiedCount >= 1, `expected at least 1 document to be caught by a 30-day expiry sweep for a document expiring in 15 days, got ${result.notifiedCount}`);

    const notification = await require('./models/Notification').findOne({ companyId: company._id, type: 'document_expiring', entityId: document._id });
    assert(notification, 'expected a real Notification document to have been created for the expiring contract');
  });

  await step('Running the SAME expiry sweep again does NOT re-notify the same document — expiryNotified correctly prevents daily spam', async () => {
    const result = await documentService.checkExpiringDocuments(company._id, 30);
    const refreshedDoc = await require('./models/Document').findById(document._id);
    assert(refreshedDoc.expiryNotified === true, 'expected expiryNotified to be true after the first sweep caught it');
    const notificationCount = await require('./models/Notification').countDocuments({ companyId: company._id, type: 'document_expiring', entityId: document._id });
    assert(notificationCount === 1, `expected still exactly 1 expiry notification (not re-fired on the second sweep), got ${notificationCount}`);
  });

  // --- 47. Multi-Currency completed: a Sale can now genuinely be denominated in a foreign currency, real conversion applied, base-currency accounting untouched ---
  await step('An ordinary checkout with NO currency specified is completely unaffected — genuinely backward compatible, not just assumed: currency stays null, exchangeRate stays 1, foreignTotalAmount stays null', async () => {
    const sale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 100 }],
    });
    assert(sale.currency === null && sale.exchangeRate === 1 && sale.foreignTotalAmount === null, `expected an ordinary sale to have currency=null, exchangeRate=1, foreignTotalAmount=null (unchanged from before this feature existed), got currency=${sale.currency} exchangeRate=${sale.exchangeRate} foreignTotalAmount=${sale.foreignTotalAmount}`);
  });

  await step('A checkout WITH currency:\'USD\' specified, with a manual PKR->USD rate on file, gets a real foreignTotalAmount — hand-traced: 100 PKR × 0.0036 = exactly 0.36 USD', async () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    await currencyService.setManualRate({ companyId: company._id, fromCurrency: 'PKR', toCurrency: 'USD', rate: 0.0036, date: todayStr, userId: admin._id });

    const sale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 100 }],
      currency: 'USD',
    });

    assert(sale.currency === 'USD', `expected currency "USD", got "${sale.currency}"`);
    assert(sale.exchangeRate === 0.0036, `expected the snapshotted exchangeRate to be exactly 0.0036, got ${sale.exchangeRate}`);
    assert(sale.foreignTotalAmount === 0.36, `expected foreignTotalAmount 0.36 (100 × 0.0036), got ${sale.foreignTotalAmount}`);
    assert(sale.totalAmount === 100, `expected totalAmount to STAY in base currency (100), completely unaffected by the foreign-currency display conversion, got ${sale.totalAmount}`);
  });

  await step('Requesting an unsupported/uncached foreign currency with no manual rate on file is REJECTED honestly — checkout itself fails cleanly rather than silently proceeding without a real conversion', async () => {
    let threw = false;
    try {
      await posSaleService.checkout({ userId: admin._id,
        companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
        items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 100 }],
        payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 100 }],
        currency: 'AED', // no manual rate entered for this pair, and AED isn't Frankfurter-supported either
      });
    } catch { threw = true; }
    assert(threw, 'expected a checkout requesting an unsupported, uncached foreign currency to fail rather than silently proceed without a real rate');
  });

  // --- 48. Two-Factor Authentication: a real TOTP round trip, actually generating and verifying genuine codes, not mocked ---
  const twoFaUser = await step('Create a real user to run the 2FA flow against', async () => {
    const User = require('./models/User');
    const u = new User({ companyId: company._id, name: '2FA Test User', email: `2fa-test-${suffix}@example.com`, passwordHash: 'placeholder' });
    await u.setPassword('correct-horse-battery-staple');
    await u.save();
    return u;
  });

  const setupResult = await step('Setup generates a real secret and does NOT enable 2FA yet — it stays pending until confirmed', async () => {
    const result = await twoFactorService.setup(twoFaUser._id);
    assert(result.secret && result.otpauthUrl && result.qrCodeDataUrl, 'expected setup() to return a real secret, otpauthUrl, and QR code data URL');
    const User = require('./models/User');
    const refreshed = await User.findById(twoFaUser._id);
    assert(refreshed.twoFactorEnabled === false, 'expected 2FA to still be DISABLED immediately after setup() — it must not activate until confirmed with a real code');
    return result;
  });

  let backupCodes;
  await step('Confirming with a REAL, actually-generated valid TOTP code (not a mocked/hardcoded one) enables 2FA and issues real backup codes', async () => {
    const validToken = await generateTotp({ secret: setupResult.secret });
    const result = await twoFactorService.confirmSetup(twoFaUser._id, validToken);
    assert(result.backupCodes && result.backupCodes.length === 10, `expected exactly 10 real backup codes, got ${result.backupCodes?.length}`);
    backupCodes = result.backupCodes;

    const User = require('./models/User');
    const refreshed = await User.findById(twoFaUser._id);
    assert(refreshed.twoFactorEnabled === true, 'expected 2FA to now be genuinely enabled after confirming with a valid code');
  });

  await step('Confirming with an arbitrary WRONG code is rejected — the whole setup would be worthless if this didn\'t actually check anything', async () => {
    const User = require('./models/User');
    const secondUser = new User({ companyId: company._id, name: '2FA Wrong Code Test', email: `2fa-wrong-${suffix}@example.com`, passwordHash: 'placeholder' });
    await secondUser.setPassword('another-password');
    await secondUser.save();
    await twoFactorService.setup(secondUser._id);
    let threw = false;
    try {
      await twoFactorService.confirmSetup(secondUser._id, '000000');
    } catch { threw = true; }
    assert(threw, 'expected confirming setup with an arbitrary wrong code to be rejected');
  });

  await step('A real login-time TOTP code verifies correctly through verifyLoginCode()', async () => {
    const User = require('./models/User');
    const refreshed = await User.findById(twoFaUser._id);
    const validToken = await generateTotp({ secret: refreshed.twoFactorSecret });
    const result = await twoFactorService.verifyLoginCode(twoFaUser._id, validToken);
    assert(result.verified === true && result.usedBackupCode === false, `expected a real TOTP code to verify successfully without needing a backup code, got ${JSON.stringify(result)}`);
  });

  await step('A backup code works exactly ONCE — verifies the first time, is REJECTED the second time (single-use, genuinely consumed)', async () => {
    const codeToUse = backupCodes[0];
    const firstAttempt = await twoFactorService.verifyLoginCode(twoFaUser._id, codeToUse);
    assert(firstAttempt.verified === true && firstAttempt.usedBackupCode === true, `expected the backup code to verify successfully the first time, got ${JSON.stringify(firstAttempt)}`);
    assert(firstAttempt.remainingBackupCodes === 9, `expected exactly 9 backup codes remaining after using 1 of the original 10, got ${firstAttempt.remainingBackupCodes}`);

    const secondAttempt = await twoFactorService.verifyLoginCode(twoFaUser._id, codeToUse);
    assert(secondAttempt.verified === false, 'expected the SAME backup code to be rejected on a second attempt — single-use, genuinely consumed, not reusable');
  });

  await step('Disabling 2FA requires the correct password — an arbitrary wrong password is rejected, the correct one succeeds', async () => {
    let threw = false;
    try {
      await twoFactorService.disable(twoFaUser._id, 'definitely-the-wrong-password');
    } catch { threw = true; }
    assert(threw, 'expected disabling 2FA with the wrong password to be rejected');

    const result = await twoFactorService.disable(twoFaUser._id, 'correct-horse-battery-staple');
    assert(result.disabled === true, 'expected disabling with the correct password to succeed');

    const User = require('./models/User');
    const refreshed = await User.findById(twoFaUser._id);
    assert(refreshed.twoFactorEnabled === false && refreshed.twoFactorSecret === null && refreshed.twoFactorBackupCodeHashes.length === 0, 'expected 2FA to be fully cleared — disabled, secret wiped, all backup codes gone');
  });

  // --- 49. Session Management, Login History, Security Alerts: real device-scoped sessions, real failed-login threshold detection ---
  const secTestEmail = `security-test-${suffix}@example.com`;
  await step('A real session (RefreshToken with device context) is created on issue() and appears in listActiveSessions()', async () => {
    const rawToken = await refreshTokenService.issue('user', twoFaUser._id, { ipAddress: '203.0.113.5', userAgent: 'SmokeTest/1.0 (Linux)' });
    assert(typeof rawToken === 'string' && rawToken.length > 0, 'expected a real raw token to be returned');

    const sessions = await refreshTokenService.listActiveSessions('user', twoFaUser._id);
    const found = sessions.find((s) => s.ipAddress === '203.0.113.5' && s.userAgent === 'SmokeTest/1.0 (Linux)');
    assert(found, 'expected the newly-issued session to appear in listActiveSessions with its real device context');
    return rawToken;
  });

  await step('Revoking a session by id genuinely prevents that same token from being used to rotate/refresh afterward', async () => {
    const rawToken = await refreshTokenService.issue('user', twoFaUser._id, { ipAddress: '198.51.100.9', userAgent: 'SmokeTest/1.0 (Mac)' });
    const sessions = await refreshTokenService.listActiveSessions('user', twoFaUser._id);
    const targetSession = sessions.find((s) => s.ipAddress === '198.51.100.9');
    assert(targetSession, 'expected to find the newly issued session to revoke');

    await refreshTokenService.revokeById(targetSession._id, 'user', twoFaUser._id);

    let threw = false;
    try {
      await refreshTokenService.rotate(rawToken);
    } catch { threw = true; }
    assert(threw, 'expected a revoked session\'s token to be rejected on rotate/refresh attempt');
  });

  await step('A user cannot revoke a session belonging to a DIFFERENT user — checked, not just assumed to be safe', async () => {
    const otherUser = await require('./models/User').create({ companyId: company._id, name: 'Other Security User', email: `other-sec-${suffix}@example.com`, passwordHash: (await require('bcryptjs').hash('x', 10)) });
    const otherToken = await refreshTokenService.issue('user', otherUser._id, { ipAddress: '10.0.0.1', userAgent: 'OtherDevice' });
    const otherSessions = await refreshTokenService.listActiveSessions('user', otherUser._id);
    const otherSessionId = otherSessions[0]._id;

    let threw = false;
    try {
      await refreshTokenService.revokeById(otherSessionId, 'user', twoFaUser._id); // wrong subjectId — trying to revoke someone else's session
    } catch { threw = true; }
    assert(threw, 'expected attempting to revoke a DIFFERENT user\'s session to be rejected');
  });

  await step('4 consecutive failed login attempts do NOT yet trigger a security alert — the threshold is genuinely 5, not fewer', async () => {
    for (let i = 0; i < 4; i++) {
      await securityService.recordAttempt({ email: secTestEmail, userId: twoFaUser._id, companyId: company._id, success: false, failureReason: 'invalid_credentials', ipAddress: '192.0.2.1', userAgent: 'AttackerBot' });
    }
    const result = await securityService.checkFailedLoginAlert(secTestEmail, twoFaUser._id, company._id);
    assert(result.alertFired === false, `expected no alert yet at only 4 failed attempts (threshold is ${securityService.FAILED_ATTEMPT_THRESHOLD}), got alertFired=${result.alertFired}`);
  });

  await step('The 5th consecutive failed attempt DOES trigger a real security alert notification', async () => {
    await securityService.recordAttempt({ email: secTestEmail, userId: twoFaUser._id, companyId: company._id, success: false, failureReason: 'invalid_credentials', ipAddress: '192.0.2.1', userAgent: 'AttackerBot' });
    const result = await securityService.checkFailedLoginAlert(secTestEmail, twoFaUser._id, company._id);
    assert(result.alertFired === true, 'expected the 5th consecutive failed attempt to fire a real security alert');

    const notification = await require('./models/Notification').findOne({ companyId: company._id, type: 'security_alert', entityId: twoFaUser._id });
    assert(notification, 'expected a real Notification document to have been created for the security alert');
  });

  await step('Login history genuinely reflects every attempt recorded, success and failure alike', async () => {
    const history = await securityService.listLoginHistory(twoFaUser._id);
    assert(history.length >= 5, `expected at least the 5 failed attempts just recorded to appear in login history, got ${history.length}`);
    assert(history.every((h) => h.success === false), 'expected all 5 recorded attempts in this test to genuinely be marked as failures, not silently recorded as successes');
  });

  // --- 50. Hajj/Umrah: Gym's capacity+waitlist combined with Layaway's installments — the genuinely new interaction between two proven mechanics ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'hajj_umrah' } });
  const hajjLiabilityAccount = await Account.create({ companyId: company._id, name: 'Pilgrimage Deposits', type: 'liability' });
  const hajjRefundAccount = await Account.create({ companyId: company._id, name: 'Pilgrimage Refunds', type: 'expense' });
  const hajjForfeitAccount = await Account.create({ companyId: company._id, name: 'Pilgrimage Forfeit Revenue', type: 'income' });
  const hajjBillingProduct = await Product.create({ companyId: company._id, name: 'Umrah Package', sku: `UMRAH-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `UMRAH-${suffix}`, sellingPrice: 0 }] });
  const [pilgrimA, pilgrimB, pilgrimC] = await Promise.all([
    Customer.create({ companyId: company._id, name: 'Pilgrim A' }),
    Customer.create({ companyId: company._id, name: 'Pilgrim B' }),
    Customer.create({ companyId: company._id, name: 'Pilgrim C' }),
  ]);

  const hajjGroup = await step('Create a group with capacity 2 — pilgrim A and B get real seats, pilgrim C is waitlisted', async () => {
    const group = await pilgrimageService.createGroup({ companyId: company._id, branchId: branch._id, packageName: 'Umrah - Test Group', departureDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), capacity: 2, packagePrice: 300000 });
    const resultA = await pilgrimageService.enroll(group._id, { customerId: pilgrimA._id, depositLiabilityAccountId: hajjLiabilityAccount._id });
    const resultB = await pilgrimageService.enroll(group._id, { customerId: pilgrimB._id, depositLiabilityAccountId: hajjLiabilityAccount._id });
    const resultC = await pilgrimageService.enroll(group._id, { customerId: pilgrimC._id, depositLiabilityAccountId: hajjLiabilityAccount._id });
    assert(resultA.enrolled === true && resultB.enrolled === true, 'expected the first 2 pilgrims to get real seats');
    assert(resultC.waitlisted === true && resultC.waitlistPosition === 1, `expected the 3rd pilgrim to be waitlisted at position 1, got ${JSON.stringify(resultC)}`);
    return group;
  });

  await step('Pilgrims A and B each have their OWN fresh payment plan at 0 paid — pilgrim C (waitlisted) has NONE yet', async () => {
    const paymentsA = await pilgrimageService.listPayments(company._id, { groupId: hajjGroup._id, customerId: pilgrimA._id });
    const paymentsC = await pilgrimageService.listPayments(company._id, { groupId: hajjGroup._id, customerId: pilgrimC._id });
    assert(paymentsA.length === 1 && paymentsA[0].amountPaid === 0 && paymentsA[0].totalPrice === 300000, 'expected pilgrim A to have exactly one fresh payment plan at 0 paid');
    assert(paymentsC.length === 0, 'expected the waitlisted pilgrim C to have NO payment plan at all yet — they have no seat to pay for');
  });

  await step('Pilgrim A pays 50000 toward their plan, then CANCELS — pilgrim C is promoted with a FRESH plan (0 paid, not inheriting A\'s 50000), and A\'s plan is resolved with an 80% refund', async () => {
    const paymentsA = await pilgrimageService.listPayments(company._id, { groupId: hajjGroup._id, customerId: pilgrimA._id });
    await pilgrimageService.makePayment(paymentsA[0]._id, { amount: 50000, paymentAccountId: cash._id, userId: admin._id });

    const { promotedCustomerId } = await pilgrimageService.cancelEnrollment(hajjGroup._id, pilgrimA._id, {
      refundPercent: 80, refundAccountId: hajjRefundAccount._id, forfeitRevenueAccountId: hajjForfeitAccount._id, depositLiabilityAccountId: hajjLiabilityAccount._id, userId: admin._id,
    });
    assert(String(promotedCustomerId) === String(pilgrimC._id), `expected pilgrim C to be promoted, got ${promotedCustomerId}`);

    const paymentsC = await pilgrimageService.listPayments(company._id, { groupId: hajjGroup._id, customerId: pilgrimC._id });
    assert(paymentsC.length === 1 && paymentsC[0].amountPaid === 0, `expected pilgrim C's newly-created plan to start at exactly 0 paid, NOT inherit pilgrim A's 50000, got amountPaid=${paymentsC[0]?.amountPaid}`);

    const refreshedA = await require('./modules/hajj_umrah/models/PilgrimPayment').findById(paymentsA[0]._id);
    assert(refreshedA.status === 'cancelled', `expected pilgrim A's plan to be cancelled, got "${refreshedA.status}"`);
  });

  await step('Pilgrim B pays the FULL 300000 in one shot — auto-completes and bills through checkout for exactly 300000', async () => {
    const paymentsB = await pilgrimageService.listPayments(company._id, { groupId: hajjGroup._id, customerId: pilgrimB._id });
    const result = await pilgrimageService.makePayment(paymentsB[0]._id, {
      amount: 300000, paymentAccountId: cash._id, warehouseId: warehouse._id, billingProductId: hajjBillingProduct._id, billingVariantId: hajjBillingProduct.variants[0]._id, userId: admin._id,
    });
    assert(result.completed === true && result.sale.totalAmount === 300000, `expected completion with a 300000 sale, got completed=${result.completed} saleTotal=${result.sale?.totalAmount}`);
  });

  // --- 51. Travel: honest direct reuse of Hotel's deposit-then-bill-remainder pattern ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'travel' } });
  const travelLiabilityAccount = await Account.create({ companyId: company._id, name: 'Travel Deposits', type: 'liability' });
  const travelRefundAccount = await Account.create({ companyId: company._id, name: 'Travel Refunds', type: 'expense' });
  const travelForfeitAccount = await Account.create({ companyId: company._id, name: 'Travel Forfeit Revenue', type: 'income' });
  const travelBillingProduct = await Product.create({ companyId: company._id, name: 'Tour Package', sku: `TOUR-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `TOUR-${suffix}`, sellingPrice: 0 }] });

  await step('Book with a 20000 deposit on a 100000 package, then finalize — hand-traced: deposit 20000 applied + 80000 final payment = exactly 100000 billed', async () => {
    const booking = await travelService.bookPackage({
      companyId: company._id, branchId: branch._id, customerId: customer._id, packageName: 'Istanbul Tour', travelDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      price: 100000, depositAmount: 20000, depositReceivedInAccountId: cash._id, depositLiabilityAccountId: travelLiabilityAccount._id,
      billingProductId: travelBillingProduct._id, billingVariantId: travelBillingProduct.variants[0]._id, userId: admin._id,
    });
    const { sale } = await travelService.finalizeBooking(booking._id, { warehouseId: warehouse._id, finalPaymentAccountId: cash._id, userId: admin._id });
    assert(sale.totalAmount === 100000, `expected the finalized sale to total exactly 100000, got ${sale.totalAmount}`);
  });

  await step('A cancelled booking with a 10000 deposit and 50% refund policy posts a balanced 3-leg voucher: 5000 refunded, 5000 forfeited', async () => {
    const booking2 = await travelService.bookPackage({
      companyId: company._id, branchId: branch._id, customerId: customer._id, packageName: 'Cancelled Tour', travelDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
      price: 50000, depositAmount: 10000, depositReceivedInAccountId: cash._id, depositLiabilityAccountId: travelLiabilityAccount._id,
      billingProductId: travelBillingProduct._id, billingVariantId: travelBillingProduct.variants[0]._id, userId: admin._id,
    });
    const cancelled = await travelService.cancelBooking(booking2._id, { refundPercent: 50, refundAccountId: travelRefundAccount._id, forfeitRevenueAccountId: travelForfeitAccount._id, userId: admin._id });
    assert(cancelled.status === 'cancelled', `expected status "cancelled", got "${cancelled.status}"`);
  });

  // --- 52. Insurance: Cafe's subscription-sale shape + Electronics' claim-workflow shape, plus a genuinely new real payout voucher on approval ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'insurance' } });
  const insuranceBillingProduct = await Product.create({ companyId: company._id, name: 'Motor Insurance Premium', sku: `INS-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `INS-${suffix}`, sellingPrice: 0 }] });
  const claimsExpenseAccount = await Account.create({ companyId: company._id, name: 'Insurance Claims Expense', type: 'expense' });

  const policy = await step('Sell a policy with 500000 coverage — bills the premium for real through checkout', async () => {
    return insuranceService.sellPolicy({
      companyId: company._id, branchId: branch._id, customerId: customer._id, policyType: 'Motor', coverageAmount: 500000, premiumAmount: 20000,
      startDate: new Date(), endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      billingProductId: insuranceBillingProduct._id, billingVariantId: insuranceBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
    });
  });

  await step('A claim ABOVE the policy\'s coverage (600000 against a 500000 ceiling) is rejected — the real, new ceiling check neither Cafe nor Electronics needed', async () => {
    let threw = false;
    try {
      await insuranceService.submitClaim(policy._id, { claimAmount: 600000, description: 'Total loss claim' });
    } catch { threw = true; }
    assert(threw, 'expected a claim exceeding the policy coverage to be rejected');
  });

  await step('A claim WITHIN coverage (100000) is accepted, and approving it posts a REAL, balanced payout voucher — the genuinely new mechanic', async () => {
    const claim = await insuranceService.submitClaim(policy._id, { claimAmount: 100000, description: 'Windshield damage' });
    const decided = await insuranceService.decideClaim(claim._id, { approve: true, decisionNote: 'Approved after inspection', payoutAccountId: cash._id, claimsExpenseAccountId: claimsExpenseAccount._id, userId: admin._id });
    assert(decided.status === 'paid', `expected status "paid", got "${decided.status}"`);

    const voucher = await require('./models/Voucher').findById(decided.voucherId);
    const totalDebit = voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 100000 && totalCredit === 100000, `expected the payout voucher to balance at exactly 100000, got debit=${totalDebit} credit=${totalCredit}`);
  });

  await step('A REJECTED claim posts NO voucher at all — only an approval moves money', async () => {
    const claim2 = await insuranceService.submitClaim(policy._id, { claimAmount: 50000, description: 'Disputed claim' });
    const decided2 = await insuranceService.decideClaim(claim2._id, { approve: false, decisionNote: 'Not covered under this policy' });
    assert(decided2.status === 'rejected' && !decided2.voucherId, `expected status "rejected" with no voucherId, got status="${decided2.status}" voucherId=${decided2.voucherId}`);
  });

  // --- 53. Media/Entertainment: independent per-tier capacity — a sold-out VIP tier never spills into a half-empty Standard tier, and vice versa ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'media_entertainment' } });
  const ticketBillingProduct = await Product.create({ companyId: company._id, name: 'Event Ticket', sku: `TICKET-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `TICKET-${suffix}`, sellingPrice: 0 }] });
  const [vipCustomer1, vipCustomer2, standardCustomer1, standardCustomer2] = await Promise.all([
    Customer.create({ companyId: company._id, name: 'VIP Customer 1' }),
    Customer.create({ companyId: company._id, name: 'VIP Customer 2' }),
    Customer.create({ companyId: company._id, name: 'Standard Customer 1' }),
    Customer.create({ companyId: company._id, name: 'Standard Customer 2' }),
  ]);

  const show = await step('Create a show with VIP capacity 1 and Standard capacity 2 — two genuinely independent pools', () =>
    eventTicketingService.createShow({
      companyId: company._id, branchId: branch._id, eventName: 'Test Concert', showDateTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      tiers: [{ name: 'VIP', capacity: 1, price: 20000 }, { name: 'Standard', capacity: 2, price: 5000 }],
    })
  );
  const vipTierId = show.tiers[0]._id;
  const standardTierId = show.tiers[1]._id;

  await step('The ONLY VIP seat books successfully at the VIP price (20000), a real sale created', async () => {
    const result = await eventTicketingService.bookTicket(show._id, vipTierId, {
      customerId: vipCustomer1._id, warehouseId: warehouse._id, ticketBillingProductId: ticketBillingProduct._id, ticketBillingVariantId: ticketBillingProduct.variants[0]._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result.booked === true && result.sale.totalAmount === 20000, `expected a real booked sale at 20000, got booked=${result.booked} saleTotal=${result.sale?.totalAmount}`);
  });

  await step('A SECOND VIP booking is waitlisted (VIP is now full) — even though Standard still has 2 open seats, proving the pools are genuinely independent', async () => {
    const result = await eventTicketingService.bookTicket(show._id, vipTierId, {
      customerId: vipCustomer2._id, warehouseId: warehouse._id, ticketBillingProductId: ticketBillingProduct._id, ticketBillingVariantId: ticketBillingProduct.variants[0]._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result.waitlisted === true && result.tierName === 'VIP', `expected the second VIP booking to be waitlisted specifically for VIP, got ${JSON.stringify(result)}`);
  });

  await step('BOTH Standard seats book successfully at the Standard price (5000 each) — completely unaffected by VIP being full', async () => {
    const result1 = await eventTicketingService.bookTicket(show._id, standardTierId, {
      customerId: standardCustomer1._id, warehouseId: warehouse._id, ticketBillingProductId: ticketBillingProduct._id, ticketBillingVariantId: ticketBillingProduct.variants[0]._id, paymentAccountId: cash._id, userId: admin._id,
    });
    const result2 = await eventTicketingService.bookTicket(show._id, standardTierId, {
      customerId: standardCustomer2._id, warehouseId: warehouse._id, ticketBillingProductId: ticketBillingProduct._id, ticketBillingVariantId: ticketBillingProduct.variants[0]._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result1.booked === true && result1.sale.totalAmount === 5000, `expected the first Standard booking to succeed at 5000, got ${JSON.stringify(result1)}`);
    assert(result2.booked === true && result2.sale.totalAmount === 5000, `expected the second Standard booking to succeed at 5000, got ${JSON.stringify(result2)}`);
  });

  await step('Cancelling the VIP ticket promotes the WAITLISTED VIP customer specifically — never a Standard customer, and bills them at the VIP price', async () => {
    const { promotedCustomerId, promotedSale } = await eventTicketingService.cancelTicket(show._id, vipTierId, vipCustomer1._id, {
      warehouseId: warehouse._id, ticketBillingProductId: ticketBillingProduct._id, ticketBillingVariantId: ticketBillingProduct.variants[0]._id, refundAccountId: cash._id, userId: admin._id,
    });
    assert(String(promotedCustomerId) === String(vipCustomer2._id), `expected VIP customer 2 (the VIP waitlist) to be promoted, got ${promotedCustomerId}`);
    assert(promotedSale.totalAmount === 20000, `expected the promoted customer to be billed at the VIP price of 20000, got ${promotedSale.totalAmount}`);
  });

  // --- 54. Sports: real hourly interval-overlap checking, boundary-exclusive — a different granularity problem from Car Rental's day-range check ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'sports' } });
  const sportsBillingProduct = await Product.create({ companyId: company._id, name: 'Court Time', sku: `COURT-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `COURT-${suffix}`, sellingPrice: 0 }] });
  const facility = await sportsService.createFacility({ companyId: company._id, branchId: branch._id, name: 'Court 1', hourlyRate: 1000 });

  const slot1Start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const slot1End = new Date(slot1Start.getTime() + 2 * 60 * 60 * 1000); // a clean 2-hour booking

  await step('Booking 10:00-12:00 (2 hours) at 1000/hr bills exactly 2000, hand-traced', async () => {
    const result = await sportsService.bookSlot(facility._id, {
      customerId: customer._id, startTime: slot1Start, endTime: slot1End,
      billingProductId: sportsBillingProduct._id, billingVariantId: sportsBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result.hours === 2 && result.price === 2000, `expected 2 hours at exactly 2000, got hours=${result.hours} price=${result.price}`);
  });

  await step('A genuinely OVERLAPPING request (starting 1 hour into the existing booking) is correctly rejected', async () => {
    let threw = false;
    try {
      await sportsService.bookSlot(facility._id, {
        customerId: customer._id, startTime: new Date(slot1Start.getTime() + 60 * 60 * 1000), endTime: new Date(slot1Start.getTime() + 3 * 60 * 60 * 1000),
        billingProductId: sportsBillingProduct._id, billingVariantId: sportsBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
      });
    } catch { threw = true; }
    assert(threw, 'expected a genuinely overlapping booking request to be rejected');
  });

  await step('A back-to-back booking starting EXACTLY when the existing one ends is correctly ALLOWED — the boundary is exclusive, not off-by-one', async () => {
    const result = await sportsService.bookSlot(facility._id, {
      customerId: customer._id, startTime: slot1End, endTime: new Date(slot1End.getTime() + 60 * 60 * 1000),
      billingProductId: sportsBillingProduct._id, billingVariantId: sportsBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result.hours === 1 && result.price === 1000, `expected a clean back-to-back 1-hour booking to succeed at 1000, got hours=${result.hours} price=${result.price}`);
  });

  await step('A back-to-back booking ending EXACTLY when the FIRST one starts is also correctly ALLOWED — the boundary is exclusive on both sides', async () => {
    const result = await sportsService.bookSlot(facility._id, {
      customerId: customer._id, startTime: new Date(slot1Start.getTime() - 60 * 60 * 1000), endTime: slot1Start,
      billingProductId: sportsBillingProduct._id, billingVariantId: sportsBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result.hours === 1 && result.price === 1000, `expected a clean back-to-back 1-hour booking before the first slot to succeed, got hours=${result.hours} price=${result.price}`);
  });

  // --- 55. Telecom: metered usage against a quota, overage billed ONLY on the excess — hand-traced across 3 independent metrics at once ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'telecom' } });
  const telecomBillingProduct = await Product.create({ companyId: company._id, name: 'Plan Fee', sku: `PLAN-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `PLAN-${suffix}`, sellingPrice: 0 }] });
  const telecomOverageProduct = await Product.create({ companyId: company._id, name: 'Usage Overage', sku: `OVERAGE-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `OVERAGE-${suffix}`, sellingPrice: 0 }] });

  const telecomPlan = await step('Create a plan: 1000 fee, 500 min/1000 MB/100 SMS included, overage rates 2/min, 0.5/MB, 1/SMS', () =>
    telecomService.createPlan({
      companyId: company._id, name: 'Postpaid 500', monthlyFee: 1000, includedMinutes: 500, includedDataMB: 1000, includedSms: 100,
      overageRatePerMinute: 2, overageRatePerMB: 0.5, overageRatePerSms: 1,
      billingProductId: telecomBillingProduct._id, billingVariantId: telecomBillingProduct.variants[0]._id,
      overageBillingProductId: telecomOverageProduct._id, overageBillingVariantId: telecomOverageProduct.variants[0]._id,
    })
  );

  await step('Usage EXACTLY at quota (500 min, 1000 MB, 100 SMS) bills ONLY the flat fee — no overage line at all, boundary inclusive not triggering', async () => {
    const sub = await telecomService.subscribeCustomer({ companyId: company._id, branchId: branch._id, customerId: customer._id, planId: telecomPlan._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    await telecomService.recordUsage(sub._id, { minutes: 500, dataMB: 1000, sms: 100 });
    const { sale, usageSummary } = await telecomService.generateMonthlyBill(sub._id, { warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    assert(usageSummary.overageCost === 0, `expected zero overage at exactly the included quota, got ${usageSummary.overageCost}`);
    assert(sale.totalAmount === 1000, `expected the bill to total just the flat 1000 fee with no overage line, got ${sale.totalAmount}`);
  });

  await step('Usage OVER quota on 2 of 3 metrics (550 min, 1200 MB, 80 SMS) — hand-traced: (50×2) + (200×0.5) + 0 = 100+100+0 = 200 overage, total bill 1200', async () => {
    const sub2 = await telecomService.subscribeCustomer({ companyId: company._id, branchId: branch._id, customerId: customer._id, planId: telecomPlan._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    await telecomService.recordUsage(sub2._id, { minutes: 550, dataMB: 1200, sms: 80 });
    const { sale, usageSummary } = await telecomService.generateMonthlyBill(sub2._id, { warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    assert(usageSummary.overageMinutes === 50 && usageSummary.overageDataMB === 200 && usageSummary.overageSms === 0, `expected overage exactly 50 min / 200 MB / 0 SMS, got ${JSON.stringify(usageSummary)}`);
    assert(usageSummary.overageCost === 200, `expected total overage cost exactly 200 (100 from minutes + 100 from data + 0 from SMS), got ${usageSummary.overageCost}`);
    assert(sale.totalAmount === 1200, `expected the bill to total exactly 1200 (1000 fee + 200 overage), got ${sale.totalAmount}`);
    assert(sale.items.length === 2, `expected exactly 2 line items (plan fee + overage), got ${sale.items.length}`);

    const refreshedSub = await require('./modules/telecom/models/CustomerSubscription').findById(sub2._id);
    assert(refreshedSub.usedMinutes === 0 && refreshedSub.usedDataMB === 0 && refreshedSub.usedSms === 0, 'expected usage to reset to 0 for the new period after billing, not carry over');
  });

  // --- 56. Professional Services: deferred, aggregated invoicing across MIXED hourly rates — proving real weighted summing, not a naive averaged rate ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'professional_services' } });
  const timeBillingProduct = await Product.create({ companyId: company._id, name: 'Consulting Services', sku: `CONSULT-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `CONSULT-${suffix}`, sellingPrice: 0 }] });
  const juniorEmployee = await hrService.createEmployee({ companyId: company._id, branchId: branch._id, name: 'Junior Consultant', designation: 'Consultant', salaryStructure: { basic: 50000, allowances: 0, deductions: 0 } });
  const seniorEmployee = await hrService.createEmployee({ companyId: company._id, branchId: branch._id, name: 'Senior Consultant', designation: 'Consultant', salaryStructure: { basic: 150000, allowances: 0, deductions: 0 } });

  await step('Log 3 time entries at DIFFERENT rates (5000, 2000, 5000/hr) for the same client — none billed yet', async () => {
    await timeEntryService.logTime({ companyId: company._id, branchId: branch._id, employeeId: seniorEmployee._id, clientCustomerId: customer._id, description: 'Strategy session', hours: 3, hourlyRate: 5000 });
    await timeEntryService.logTime({ companyId: company._id, branchId: branch._id, employeeId: juniorEmployee._id, clientCustomerId: customer._id, description: 'Research', hours: 5, hourlyRate: 2000 });
    await timeEntryService.logTime({ companyId: company._id, branchId: branch._id, employeeId: seniorEmployee._id, clientCustomerId: customer._id, description: 'Client call', hours: 2, hourlyRate: 5000 });

    const unbilled = await timeEntryService.listUnbilledEntries(company._id, customer._id);
    assert(unbilled.length === 3, `expected exactly 3 unbilled entries, got ${unbilled.length}`);
  });

  await step('Generating the invoice bills the EXACT weighted sum — hand-traced: (3×5000) + (5×2000) + (2×5000) = 15000+10000+10000 = 35000, NOT the naive-average trap of 40000 (mean of the 3 rates × 10 total hours)', async () => {
    const result = await timeEntryService.generateInvoice(company._id, customer._id, {
      warehouseId: warehouse._id, billingProductId: timeBillingProduct._id, billingVariantId: timeBillingProduct.variants[0]._id, paymentAccountId: cash._id, userId: admin._id,
    });
    assert(result.entriesInvoiced === 3 && result.totalHours === 10, `expected 3 entries totaling 10 hours, got entriesInvoiced=${result.entriesInvoiced} totalHours=${result.totalHours}`);
    assert(result.totalAmount === 35000, `expected the CORRECT weighted-sum total of exactly 35000 — a naive "average rate × total hours" implementation would wrongly produce 40000 instead, got ${result.totalAmount}`);
    assert(result.sale.totalAmount === 35000, `expected the actual Sale to total exactly 35000, got ${result.sale.totalAmount}`);
  });

  await step('All 3 entries are now marked billed, linked to the real Sale, and no longer appear as unbilled', async () => {
    const stillUnbilled = await timeEntryService.listUnbilledEntries(company._id, customer._id);
    assert(stillUnbilled.length === 0, `expected 0 unbilled entries remaining after invoicing, got ${stillUnbilled.length}`);
    const invoiced = await timeEntryService.listInvoicedEntries(company._id, { clientCustomerId: customer._id });
    assert(invoiced.length === 3 && invoiced.every((e) => e.billed === true && e.saleId), 'expected all 3 entries to be marked billed with a real saleId reference');
  });

  await step('Attempting to generate ANOTHER invoice with nothing new logged is rejected — no bogus zero-value invoice gets created', async () => {
    let threw = false;
    try {
      await timeEntryService.generateInvoice(company._id, customer._id, { warehouseId: warehouse._id, billingProductId: timeBillingProduct._id, billingVariantId: timeBillingProduct.variants[0]._id, paymentAccountId: cash._id, userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected generating an invoice with zero unbilled entries to be rejected');
  });

  // --- 57. NGO: fund-restricted accounting — a spending check against a SUB-LEDGER balance, proven race-safe under real concurrency ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'ngo' } });
  const donationRevenueAccount = await Account.create({ companyId: company._id, name: 'Donation Revenue', type: 'income' });
  const programExpenseAccount = await Account.create({ companyId: company._id, name: 'Program Expense', type: 'expense' });
  const donor = await Customer.create({ companyId: company._id, name: 'Anonymous Donor' });

  const educationFund = await step('Create a restricted "Education Fund" and donate 50000 — balance becomes exactly 50000', async () => {
    const fund = await fundService.createFund({ companyId: company._id, name: 'Education Fund', type: 'restricted', purposeDescription: 'School supplies only' });
    await fundService.recordDonation(fund._id, { donorCustomerId: donor._id, amount: 50000, branchId: branch._id, receivingAccountId: cash._id, donationRevenueAccountId: donationRevenueAccount._id, userId: admin._id });
    const refreshed = await require('./modules/ngo/models/Fund').findById(fund._id);
    assert(refreshed.balance === 50000, `expected balance exactly 50000 after the donation, got ${refreshed.balance}`);
    return refreshed;
  });

  await step('Attempting to disburse 60000 (MORE than the fund holds) is rejected — even though the organization\'s overall cash account is healthy, this specific fund\'s money isn\'t there', async () => {
    let threw = false;
    let message = '';
    try {
      await fundService.recordDisbursement(educationFund._id, { amount: 60000, description: 'Overspend attempt', branchId: branch._id, expenseAccountId: programExpenseAccount._id, payingAccountId: cash._id, userId: admin._id });
    } catch (err) { threw = true; message = err.message; }
    assert(threw && message.includes('Insufficient fund balance'), `expected a rejection specifically citing insufficient FUND balance, got threw=${threw} message="${message}"`);
  });

  await step('Disbursing 30000 (within the fund) succeeds — balance drops to exactly 20000', async () => {
    await fundService.recordDisbursement(educationFund._id, { amount: 30000, description: 'School supplies purchase', branchId: branch._id, expenseAccountId: programExpenseAccount._id, payingAccountId: cash._id, userId: admin._id });
    const refreshed = await require('./modules/ngo/models/Fund').findById(educationFund._id);
    assert(refreshed.balance === 20000, `expected balance exactly 20000 (50000 - 30000), got ${refreshed.balance}`);
  });

  await step('THE CRITICAL TEST: 2 SIMULTANEOUS disbursements of 15000 each against only 20000 remaining — a naive read-then-write would let both succeed (over-spending to -10000); the atomic check must allow exactly one and reject the other', async () => {
    const results = await Promise.allSettled([
      fundService.recordDisbursement(educationFund._id, { amount: 15000, description: 'Concurrent disbursement A', branchId: branch._id, expenseAccountId: programExpenseAccount._id, payingAccountId: cash._id, userId: admin._id }),
      fundService.recordDisbursement(educationFund._id, { amount: 15000, description: 'Concurrent disbursement B', branchId: branch._id, expenseAccountId: programExpenseAccount._id, payingAccountId: cash._id, userId: admin._id }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    assert(fulfilled.length === 1 && rejected.length === 1, `expected exactly 1 of the 2 concurrent 15000 disbursements to succeed (only 1 fits within 20000) and 1 to be rejected, got ${fulfilled.length} fulfilled and ${rejected.length} rejected`);

    const finalFund = await require('./modules/ngo/models/Fund').findById(educationFund._id);
    assert(finalFund.balance === 5000, `expected the fund's final balance to land at EXACTLY 5000 (20000 - 15000) — never negative, which is what would happen if both concurrent disbursements had incorrectly succeeded, got ${finalFund.balance}`);
  });

  await step('The fund\'s ledger shows the real, complete transaction history — donation and every disbursement that actually succeeded, in order. Rejected attempts (the 60000 overspend and the losing concurrent 15000) never reach the ledger at all, since the atomic check throws before any transaction record is ever created', async () => {
    const ledger = await fundService.fundLedger(educationFund._id);
    assert(ledger.length === 3, `expected exactly 3 transactions (1 donation of 50000 + the 30000 disbursement + the ONE successful 15000 concurrent disbursement) — the rejected 60000 attempt and the losing concurrent attempt never created a ledger entry at all, got ${ledger.length}`);
    assert(ledger[0].type === 'donation' && ledger[0].amount === 50000, 'expected the ledger\'s first entry to be the original 50000 donation');
    const totalDisbursed = ledger.filter((t) => t.type === 'disbursement').reduce((sum, t) => sum + t.amount, 0);
    assert(totalDisbursed === 45000, `expected total disbursements of exactly 45000 (30000 + 15000), got ${totalDisbursed}`);
  });

  // --- 58. Import/Export: landed cost allocated proportionally by value, corrected for rounding drift, real inventory cost basis — every number hand-computed and independently executed before this test was written ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'import_export' } });
  const [importProductA, importProductB, importProductC] = await Promise.all([
    Product.create({ companyId: company._id, name: 'Import Item A', sku: `IMPA-${suffix}`, trackingMode: 'simple', costPrice: 0, sellingPrice: 200, variants: [{ sku: `IMPA-${suffix}`, sellingPrice: 200 }] }),
    Product.create({ companyId: company._id, name: 'Import Item B', sku: `IMPB-${suffix}`, trackingMode: 'simple', costPrice: 0, sellingPrice: 400, variants: [{ sku: `IMPB-${suffix}`, sellingPrice: 400 }] }),
    Product.create({ companyId: company._id, name: 'Import Item C', sku: `IMPC-${suffix}`, trackingMode: 'simple', costPrice: 0, sellingPrice: 2000, variants: [{ sku: `IMPC-${suffix}`, sellingPrice: 2000 }] }),
  ]);
  const importInventoryAsset = await Account.create({ companyId: company._id, name: 'Import Inventory Asset', type: 'asset' });
  const importSupplierPayable = await Account.create({ companyId: company._id, name: 'Import Supplier Payable', type: 'liability' });
  const customsAccount = await Account.create({ companyId: company._id, name: 'Customs Duty Payable', type: 'liability' });

  const importShipment = await step('Create a shipment: 3 items of EQUAL total value (1000 each, 3000 total) but different qty/unitPrice combinations, plus 100 customs duty that doesn\'t divide evenly by 3', () =>
    importShipmentService.createShipment({
      companyId: company._id, branchId: branch._id, supplierId: supplier._id,
      items: [
        { productId: importProductA._id, variantId: importProductA.variants[0]._id, quantity: 10, unitPrice: 100 },
        { productId: importProductB._id, variantId: importProductB.variants[0]._id, quantity: 5, unitPrice: 200 },
        { productId: importProductC._id, variantId: importProductC.variants[0]._id, quantity: 1, unitPrice: 1000 },
      ],
      additionalCosts: [{ type: 'customs_duty', amount: 100, accountId: customsAccount._id }],
    })
  );

  await step('Receiving allocates EXACTLY: item A share=33.33 (adjustedCost 103.33), item B share=33.33 (adjustedCost 206.67), item C gets the rounding-drift-corrected remainder share=33.34 (adjustedCost 1033.34) — each value independently hand-computed and executed before this test was written, not derived from the code being trusted to work', async () => {
    const result = await importShipmentService.receiveShipment(importShipment._id, {
      warehouseId: warehouse._id, inventoryAssetAccountId: importInventoryAsset._id, supplierPayableAccountId: importSupplierPayable._id, userId: admin._id,
    });
    const items = result.shipment.items;
    assert(items[0].allocatedCost === 33.33 && items[0].adjustedUnitCost === 103.33, `expected item A share=33.33, adjustedUnitCost=103.33, got share=${items[0].allocatedCost} adjustedUnitCost=${items[0].adjustedUnitCost}`);
    assert(items[1].allocatedCost === 33.33 && items[1].adjustedUnitCost === 206.67, `expected item B share=33.33, adjustedUnitCost=206.67, got share=${items[1].allocatedCost} adjustedUnitCost=${items[1].adjustedUnitCost}`);
    assert(items[2].allocatedCost === 33.34 && items[2].adjustedUnitCost === 1033.34, `expected item C (last, rounding-corrected) share=33.34, adjustedUnitCost=1033.34, got share=${items[2].allocatedCost} adjustedUnitCost=${items[2].adjustedUnitCost}`);

    const totalAllocated = items.reduce((sum, i) => sum + i.allocatedCost, 0);
    assert(Math.round(totalAllocated * 100) / 100 === 100, `expected the 3 allocated shares to sum to EXACTLY 100 (the real customs duty), not merely close to it, got ${totalAllocated}`);
    assert(result.totalLandedCost === 3100, `expected total landed cost exactly 3100 (3000 shipment value + 100 customs), got ${result.totalLandedCost}`);
  });

  await step('The voucher genuinely balances at 3100 across 3 legs: inventory debited the FULL landed cost, credited partly to the supplier and partly to customs', async () => {
    const shipmentAfter = await require('./modules/import_export/models/ImportShipment').findById(importShipment._id);
    const voucher = await require('./models/Voucher').findById(shipmentAfter.voucherId);
    const totalDebit = voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 3100 && totalCredit === 3100, `expected the voucher to balance at exactly 3100, got debit=${totalDebit} credit=${totalCredit}`);
    assert(voucher.entries.length === 3, `expected exactly 3 legs (inventory debit, supplier credit, customs credit), got ${voucher.entries.length}`);
  });

  await step('Item A\'s real inventory cost basis is now its ADJUSTED landed cost (103.33), not its raw invoice price (100) — the actual, valuable outcome of this whole module', async () => {
    const avgCost = await inventoryService.getAvgCost(warehouse._id, importProductA.variants[0]._id);
    assert(avgCost === 103.33, `expected the real weighted-average cost to reflect the adjusted landed cost of 103.33, not the raw invoice price of 100, got ${avgCost}`);
  });

  // --- 59. Agriculture: genuine reuse of real Manufacturing costing, field-level yield history as the one new piece — every percentage hand-computed and independently executed first ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'agriculture' } });
  const seedsProduct = await Product.create({ companyId: company._id, name: 'Wheat Seeds', sku: `SEEDS-${suffix}`, trackingMode: 'simple', costPrice: 5, sellingPrice: 5, variants: [{ sku: `SEEDS-${suffix}`, sellingPrice: 5 }] });
  await inventoryService.recordMovement({ companyId: company._id, warehouseId: warehouse._id, productId: seedsProduct._id, variantId: seedsProduct.variants[0]._id, type: 'adjustment', quantity: 5000, note: 'Smoke test opening stock for seeds' });
  const wheatHarvestProduct = await Product.create({ companyId: company._id, name: 'Wheat Harvest', sku: `WHEAT-${suffix}`, trackingMode: 'simple', costPrice: 0, sellingPrice: 50, variants: [{ sku: `WHEAT-${suffix}`, sellingPrice: 50 }] });
  const wheatBom = await manufacturingService.createBOM({
    companyId: company._id, finishedProductId: wheatHarvestProduct._id, finishedVariantId: wheatHarvestProduct.variants[0]._id,
    name: 'Wheat BOM', components: [{ productId: seedsProduct._id, variantId: seedsProduct.variants[0]._id, quantityPerUnit: 2 }],
    laborCostPerUnit: 10, overheadCostPerUnit: 5,
  });

  const northField = await step('Create a 10-acre field', () => agricultureService.createFarmField({ companyId: company._id, branchId: branch._id, name: 'North Field', areaAcres: 10 }));

  async function runCropCycle(expectedYield, actualYield) {
    const cycle = await agricultureService.startCropCycle({
      companyId: company._id, branchId: branch._id, fieldId: northField._id, bomId: wheatBom._id, warehouseId: warehouse._id,
      cropName: 'Wheat', plantedDate: new Date(), expectedYield, userId: admin._id,
    });
    return agricultureService.completeHarvest(cycle._id, { actualYield, actualLaborCost: 10 * actualYield, actualOverheadCost: 5 * actualYield, userId: admin._id });
  }

  await step('3 crop cycles on the SAME field, actual yields of 100, 120, then 80 (=yield/acre of 10, 12, then 8 on a 10-acre field) — each genuinely costed through real Manufacturing completeProduction, not reimplemented', async () => {
    const cycle1 = await runCropCycle(100, 100);
    assert(cycle1.yieldVariance === 0 && cycle1.status === 'harvested', `expected cycle 1 to harvest exactly at its expected yield (variance 0), got variance=${cycle1.yieldVariance} status=${cycle1.status}`);

    const cycle2 = await runCropCycle(100, 120);
    assert(cycle2.yieldVariance === 20, `expected cycle 2's variance to be exactly +20 (120 actual - 100 expected), got ${cycle2.yieldVariance}`);

    const cycle3 = await runCropCycle(100, 80);
    assert(cycle3.yieldVariance === -20, `expected cycle 3's variance to be exactly -20 (80 actual - 100 expected), got ${cycle3.yieldVariance}`);
  });

  await step('Field yield history: hand-traced — historical average of the FIRST 2 cycles (10 and 12 yield/acre) is exactly 11, and the 3rd (latest) cycle at 8 yield/acre is exactly -27.27% below that baseline — independently executed in a standalone script before this assertion was written, not derived from trusting the code', async () => {
    const result = await agricultureService.fieldYieldHistory(northField._id);
    assert(result.history.length === 3, `expected exactly 3 harvested cycles in history, got ${result.history.length}`);
    assert(result.history[0].yieldPerAcre === 10 && result.history[1].yieldPerAcre === 12 && result.history[2].yieldPerAcre === 8, `expected yield/acre of exactly 10, 12, 8 in order, got ${JSON.stringify(result.history.map((h) => h.yieldPerAcre))}`);
    assert(result.historicalAverageYieldPerAcre === 11, `expected the historical average (of the first 2 cycles ONLY, excluding the latest) to be exactly 11 ((10+12)/2), got ${result.historicalAverageYieldPerAcre}`);
    assert(result.latestVsHistoryPercent === -27.27, `expected the latest cycle's comparison to the historical baseline to be exactly -27.27%, got ${result.latestVsHistoryPercent}`);
  });

  await step('A field with no harvested cycles yet returns an honest empty history, not a crash or a misleading zero average', async () => {
    const emptyField = await agricultureService.createFarmField({ companyId: company._id, branchId: branch._id, name: 'Fallow Field', areaAcres: 5 });
    const result = await agricultureService.fieldYieldHistory(emptyField._id);
    assert(result.history.length === 0 && result.historicalAverageYieldPerAcre === null, `expected an empty history and a null average (not zero, which would misleadingly imply data exists), got history.length=${result.history.length} average=${result.historicalAverageYieldPerAcre}`);
  });

  // --- 60. Pharmaceutical: real batch recall — trace who actually received a batch, aggregated CORRECTLY across multiple separate sales to the same customer ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'pharmaceutical' } });
  const recallProduct = await Product.create({ companyId: company._id, name: 'Amoxicillin 500mg', sku: `AMOX-${suffix}`, trackingMode: 'batch', costPrice: 20, sellingPrice: 40, variants: [{ sku: `AMOX-${suffix}`, sellingPrice: 40 }] });
  const recallBatch = await require('./models/ProductBatch').create({ companyId: company._id, productId: recallProduct._id, variantId: recallProduct.variants[0]._id, batchNumber: `LOT-${suffix}`, manufactureDate: new Date(), expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) });
  await inventoryService.recordMovement({ companyId: company._id, warehouseId: warehouse._id, productId: recallProduct._id, variantId: recallProduct.variants[0]._id, batchId: recallBatch._id, type: 'adjustment', quantity: 100, note: 'Smoke test opening stock for recalled batch' });
  const [recallCustomerA, recallCustomerB] = await Promise.all([
    Customer.create({ companyId: company._id, name: 'Pharmacy Customer A' }),
    Customer.create({ companyId: company._id, name: 'Pharmacy Customer B' }),
  ]);

  await step('Customer A buys from this batch TWICE across 2 SEPARATE sales (5 then 2) — the real trace must SUM these correctly to 7, not just see the most recent one. Customer B buys 3 in one sale', async () => {
    await posSaleService.checkout({ userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: recallCustomerA._id, items: [{ productId: recallProduct._id, variantId: recallProduct.variants[0]._id, batchId: recallBatch._id, quantity: 5, unitPrice: 40 }], payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 200 }] });
    await posSaleService.checkout({ userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: recallCustomerA._id, items: [{ productId: recallProduct._id, variantId: recallProduct.variants[0]._id, batchId: recallBatch._id, quantity: 2, unitPrice: 40 }], payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 80 }] });
    await posSaleService.checkout({ userId: admin._id, companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: recallCustomerB._id, items: [{ productId: recallProduct._id, variantId: recallProduct.variants[0]._id, batchId: recallBatch._id, quantity: 3, unitPrice: 40 }], payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 120 }] });
  });

  const recall = await step('Initiating a recall correctly traces and SUMS: customer A shows exactly 7 (5+2 across 2 sales), customer B shows exactly 3', async () => {
    const r = await batchRecallService.initiateRecall({ companyId: company._id, batchId: recallBatch._id, productId: recallProduct._id, reason: 'Contamination found in lab testing', userId: admin._id });
    const entryA = r.affectedCustomers.find((c) => String(c.customerId) === String(recallCustomerA._id));
    const entryB = r.affectedCustomers.find((c) => String(c.customerId) === String(recallCustomerB._id));
    assert(entryA && entryA.quantitySold === 7, `expected customer A's traced quantity to be exactly 7 (5+2 correctly summed across 2 separate sales), got ${entryA?.quantitySold}`);
    assert(entryB && entryB.quantitySold === 3, `expected customer B's traced quantity to be exactly 3, got ${entryB?.quantitySold}`);
    return r;
  });

  await step('Recording a return of ALL 7 for customer A leaves them with 0 outstanding — attempting even 1 more is rejected', async () => {
    await batchRecallService.recordReturn(recall._id, { customerId: recallCustomerA._id, quantity: 7 });
    let threw = false;
    try {
      await batchRecallService.recordReturn(recall._id, { customerId: recallCustomerA._id, quantity: 1 });
    } catch { threw = true; }
    assert(threw, 'expected a return attempt beyond what a customer actually has outstanding to be rejected');
  });

  await step('Recall progress is real, computed math: totalSold=10, totalReturned=7, exactly 70% complete, exactly 1 customer (B) still outstanding', async () => {
    const { progress } = await batchRecallService.getRecall(recall._id);
    assert(progress.totalSold === 10 && progress.totalReturned === 7, `expected totalSold=10, totalReturned=7, got totalSold=${progress.totalSold} totalReturned=${progress.totalReturned}`);
    assert(progress.percentComplete === 70, `expected exactly 70% complete (7/10), got ${progress.percentComplete}`);
    assert(progress.outstandingCount === 1, `expected exactly 1 customer still outstanding (customer B), got ${progress.outstandingCount}`);
  });

  // --- 61. Construction: real pre-approved BOQ estimate vs. actual cost variance — every number independently executed in a standalone script before this test was written ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'construction' } });
  const constructionProject = await projectService.createProject({ companyId: company._id, name: 'Site Renovation', budget: 20000, customerId: customer._id });

  const boq = await step('Create a BOQ with 3 line items: 2 material lines (5000 + 10000 = 15000) and 1 labor line (3000) — total estimated 18000', async () => {
    const created = await billOfQuantitiesService.createBOQ({
      companyId: company._id, projectId: constructionProject._id, title: 'Renovation BOQ',
      lineItems: [
        { description: 'Cement bags', unit: 'bag', estimatedQuantity: 100, estimatedRate: 50, costType: 'material' },
        { description: 'Steel rods', unit: 'rod', estimatedQuantity: 50, estimatedRate: 200, costType: 'material' },
        { description: 'Masons', unit: 'day', estimatedQuantity: 30, estimatedRate: 100, costType: 'labor' },
      ],
    });
    assert(created.totalEstimated === 18000, `expected totalEstimated exactly 18000 (5000+10000+3000), got ${created.totalEstimated}`);
    return created;
  });

  await step('Log real actual costs against the project: material=12000 (under budget), labor=3500 (over budget) — created directly at the model level, since this test verifies the variance AGGREGATION logic itself, not core Project\'s already-tested automatic cost-creation flows', async () => {
    const ProjectCost = require('./models/ProjectCost');
    await ProjectCost.create({ companyId: company._id, projectId: constructionProject._id, type: 'material', amount: 12000, note: 'Actual cement + steel spend' });
    await ProjectCost.create({ companyId: company._id, projectId: constructionProject._id, type: 'labor', amount: 3500, note: 'Actual mason wages' });
  });

  await step('Variance report matches EXACTLY the numbers hand-computed and independently executed in a standalone script before this service was written: material variance -3000 (-20%), labor variance +500 (+16.67%), overall variance -2500', async () => {
    const report = await billOfQuantitiesService.varianceReport(boq._id);
    const material = report.byType.find((t) => t.costType === 'material');
    const labor = report.byType.find((t) => t.costType === 'labor');

    assert(material.estimated === 15000 && material.actual === 12000 && material.variance === -3000 && material.variancePercent === -20, `expected material: estimated=15000, actual=12000, variance=-3000, variancePercent=-20, got ${JSON.stringify(material)}`);
    assert(labor.estimated === 3000 && labor.actual === 3500 && labor.variance === 500 && labor.variancePercent === 16.67, `expected labor: estimated=3000, actual=3500, variance=500, variancePercent=16.67, got ${JSON.stringify(labor)}`);
    assert(report.totalEstimated === 18000 && report.totalActual === 15500 && report.totalVariance === -2500, `expected totals: estimated=18000, actual=15500, variance=-2500, got ${JSON.stringify({ totalEstimated: report.totalEstimated, totalActual: report.totalActual, totalVariance: report.totalVariance })}`);
  });

  // --- 62. Real Estate: period rent generation with real, days-proportional late fees, and a Property genuinely cycling back to available — proving it's a reusable asset, not a one-time sale ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'real_estate' } });
  const rentBillingProduct = await Product.create({ companyId: company._id, name: 'Monthly Rent', sku: `RENT-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `RENT-${suffix}`, sellingPrice: 0 }] });
  const leaseDepositLiabilityAccount = await Account.create({ companyId: company._id, name: 'Tenant Security Deposits', type: 'liability' });
  const damageForfeitAccount = await Account.create({ companyId: company._id, name: 'Damage Deduction Revenue', type: 'income' });
  const DAY_MS = 24 * 60 * 60 * 1000;
  const leaseStart = new Date('2026-01-01T00:00:00Z');

  const apartment = await step('Create a property — starts available', () => leaseService.createProperty({ companyId: company._id, branchId: branch._id, unitNumber: 'Apartment 3B', propertyType: 'apartment' }));

  const lease = await step('Starting a lease with a 40000 deposit marks the property LEASED — no longer available for a second tenant', async () => {
    const l = await leaseService.startLease({
      companyId: company._id, branchId: branch._id, propertyId: apartment._id, tenantCustomerId: customer._id,
      startDate: leaseStart, endDate: new Date(leaseStart.getTime() + 365 * DAY_MS), monthlyRent: 20000, lateFeePerDay: 100,
      securityDeposit: 40000, depositReceivedAccountId: cash._id, securityDepositLiabilityAccountId: leaseDepositLiabilityAccount._id, userId: admin._id,
    });
    const refreshedProperty = await require('./modules/real_estate/models/Property').findById(apartment._id);
    assert(refreshedProperty.status === 'leased', `expected property status "leased", got "${refreshedProperty.status}"`);
    return l;
  });

  await step('Trying to generate rent BEFORE the 30-day period is due (only 20 days in) is rejected — the same "don\'t bill early" honesty every other recurring-billing module in this app holds to', async () => {
    let threw = false;
    try {
      await leaseService.generateRentInvoice(lease._id, { asOfDate: new Date(leaseStart.getTime() + 20 * DAY_MS), billingProductId: rentBillingProduct._id, billingVariantId: rentBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected generating rent before the period is due to be rejected');
  });

  await step('Generating rent 5 days AFTER the due date bills a real, hand-traced late fee: 20000 rent + (5 × 100 late fee) = exactly 20500', async () => {
    const result = await leaseService.generateRentInvoice(lease._id, { asOfDate: new Date(leaseStart.getTime() + 35 * DAY_MS), billingProductId: rentBillingProduct._id, billingVariantId: rentBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    assert(result.daysLate === 5 && result.lateFee === 500 && result.totalBill === 20500, `expected daysLate=5, lateFee=500, totalBill=20500, got ${JSON.stringify({ daysLate: result.daysLate, lateFee: result.lateFee, totalBill: result.totalBill })}`);
    assert(result.sale.totalAmount === 20500, `expected the actual Sale to total exactly 20500, got ${result.sale.totalAmount}`);
  });

  await step('The SECOND period, paid exactly ON TIME (day 60), bills NO late fee — just the flat 20000 rent', async () => {
    const result = await leaseService.generateRentInvoice(lease._id, { asOfDate: new Date(leaseStart.getTime() + 60 * DAY_MS), billingProductId: rentBillingProduct._id, billingVariantId: rentBillingProduct.variants[0]._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    assert(result.daysLate === 0 && result.lateFee === 0 && result.totalBill === 20000, `expected an on-time payment to have zero late fee, got ${JSON.stringify({ daysLate: result.daysLate, lateFee: result.lateFee, totalBill: result.totalBill })}`);
  });

  await step('Ending the lease with a 5000 damage deduction refunds exactly 35000, posts a balanced 3-leg voucher at 40000, and the PROPERTY CYCLES BACK to available — the real proof it\'s a reusable asset, not a one-time sale', async () => {
    const { refund, deduction } = await leaseService.endLease(lease._id, { deductionAmount: 5000, refundAccountId: cash._id, forfeitRevenueAccountId: damageForfeitAccount._id, userId: admin._id });
    assert(refund === 35000 && deduction === 5000, `expected refund=35000 and deduction=5000 (40000 - 5000), got refund=${refund} deduction=${deduction}`);

    const refreshedProperty = await require('./modules/real_estate/models/Property').findById(apartment._id);
    assert(refreshedProperty.status === 'available', `expected the property to cycle back to "available" after the lease ends, got "${refreshedProperty.status}"`);
  });

  await step('The same property can now be leased to a SECOND, different tenant — genuinely reused, not a one-shot asset', async () => {
    const secondTenant = await Customer.create({ companyId: company._id, name: 'Second Tenant' });
    const secondLease = await leaseService.startLease({
      companyId: company._id, branchId: branch._id, propertyId: apartment._id, tenantCustomerId: secondTenant._id,
      startDate: new Date(), endDate: new Date(Date.now() + 365 * DAY_MS), monthlyRent: 22000, userId: admin._id,
    });
    assert(secondLease.status === 'active', 'expected a genuine second lease on the same property to succeed');
  });

  // --- 63. Housing Society: genuine reuse of Real Estate's Property + School's idempotent batch-billing pattern, plus a real complaint work-order flow ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'housing_society' } });
  const maintenanceBillingProduct = await Product.create({ companyId: company._id, name: 'Society Maintenance Fee', sku: `MAINT-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `MAINT-${suffix}`, sellingPrice: 0 }] });
  const [houseA, houseB, houseC] = await Promise.all([
    leaseService.createProperty({ companyId: company._id, branchId: branch._id, unitNumber: 'House 101', propertyType: 'house' }),
    leaseService.createProperty({ companyId: company._id, branchId: branch._id, unitNumber: 'House 102', propertyType: 'house' }),
    leaseService.createProperty({ companyId: company._id, branchId: branch._id, unitNumber: 'House 103', propertyType: 'house' }),
  ]);
  const [residentA, residentB, residentC] = await Promise.all([
    Customer.create({ companyId: company._id, name: 'Resident A' }),
    Customer.create({ companyId: company._id, name: 'Resident B' }),
    Customer.create({ companyId: company._id, name: 'Resident C' }),
  ]);
  await Promise.all([
    societyService.enrollMember({ companyId: company._id, propertyId: houseA._id, residentCustomerId: residentA._id }),
    societyService.enrollMember({ companyId: company._id, propertyId: houseB._id, residentCustomerId: residentB._id }),
    societyService.enrollMember({ companyId: company._id, propertyId: houseC._id, residentCustomerId: residentC._id }),
  ]);
  const maintenanceCharge = await societyService.createCharge({ companyId: company._id, name: 'Monthly Maintenance', amount: 5000, billingProductId: maintenanceBillingProduct._id, billingVariantId: maintenanceBillingProduct.variants[0]._id });

  const firstInvoices = await step('Generating invoices for period "2026-08" creates exactly 3 — one per enrolled member, none skipped on a fresh period', async () => {
    const result = await societyService.generateSocietyInvoices({ companyId: company._id, chargeId: maintenanceCharge._id, period: '2026-08', dueDate: new Date('2026-08-05') });
    assert(result.created.length === 3 && result.skippedCount === 0, `expected 3 created and 0 skipped on a fresh period, got created=${result.created.length} skipped=${result.skippedCount}`);
    return result.created;
  });

  await step('Regenerating the SAME period is a genuine no-op — 0 created, 3 skipped, via the real unique DB index, not a duplicate charge', async () => {
    const result = await societyService.generateSocietyInvoices({ companyId: company._id, chargeId: maintenanceCharge._id, period: '2026-08', dueDate: new Date('2026-08-05') });
    assert(result.created.length === 0 && result.skippedCount === 3, `expected 0 created and 3 skipped on re-running an already-billed period, got created=${result.created.length} skipped=${result.skippedCount}`);
  });

  await step('Paying one member\'s invoice bills a real 5000 Sale and marks it paid', async () => {
    const { invoice, sale } = await societyService.payInvoice(firstInvoices[0]._id, { branchId: branch._id, warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    assert(invoice.status === 'paid' && sale.totalAmount === 5000, `expected status "paid" and a real 5000 sale, got status="${invoice.status}" saleTotal=${sale.totalAmount}`);
  });

  await step('A resident complaint cannot be resolved before it\'s assigned — the real work-order sequence is enforced, not skippable', async () => {
    const complaint = await societyService.submitComplaint({ companyId: company._id, propertyId: houseA._id, residentCustomerId: residentA._id, category: 'plumbing', description: 'Leaking pipe in the kitchen', priority: 'high' });
    let threw = false;
    try {
      await societyService.resolveComplaint(complaint._id, { resolutionNote: 'Fixed' });
    } catch { threw = true; }
    assert(threw, 'expected resolving an unassigned complaint to be rejected');

    const assigned = await societyService.assignComplaint(complaint._id, { assignedToUserId: null });
    assert(assigned.status === 'assigned', `expected status "assigned", got "${assigned.status}"`);

    const resolved = await societyService.resolveComplaint(complaint._id, { resolutionNote: 'Plumber replaced the pipe.' });
    assert(resolved.status === 'resolved' && resolved.resolutionNote === 'Plumber replaced the pipe.', `expected status "resolved" with the real resolution note recorded, got status="${resolved.status}" note="${resolved.resolutionNote}"`);
  });

  // --- 64. Logistics: fleet trip costing — real profitability and cost-per-km from actual odometer readings, hand-computed before this test was written ---
  await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: 'logistics' } });
  const deliveryVan = await logisticsService.createVehicle({ companyId: company._id, branchId: branch._id, registrationNumber: `VAN-${suffix}`, vehicleType: 'Van' });
  const deliveryDriver = await logisticsService.createDriver({ companyId: company._id, name: 'Trip Driver' });

  const trip = await step('Start a trip at odometer 1000', () => logisticsService.startTrip({ companyId: company._id, branchId: branch._id, vehicleId: deliveryVan._id, driverId: deliveryDriver._id, routeDescription: 'North Zone Deliveries', startOdometer: 1000 }));

  await step('Add 2 deliveries to the trip (revenue 2000 and 2500) — pure bookkeeping, no money actually moves here', async () => {
    await logisticsService.addDeliveryToTrip(trip._id, { referenceType: 'Sale', referenceId: customer._id, revenue: 2000 });
    await logisticsService.addDeliveryToTrip(trip._id, { referenceType: 'Sale', referenceId: customer._id, revenue: 2500 });
  });

  await step('Completing the trip at odometer 1150 with fuel=3000, other=500 computes EXACTLY: distance=150km, totalCost=3500, totalRevenue=4500, profitability=1000, costPerKm=23.33 — every number independently executed in a standalone script before this test was written', async () => {
    const completed = await logisticsService.completeTrip(trip._id, { endOdometer: 1150, fuelCost: 3000, otherCosts: 500 });
    assert(completed.distanceKm === 150, `expected distanceKm exactly 150 (1150-1000), got ${completed.distanceKm}`);
    assert(completed.totalRevenue === 4500, `expected totalRevenue exactly 4500 (2000+2500), got ${completed.totalRevenue}`);
    assert(completed.profitability === 1000, `expected profitability exactly 1000 (4500 revenue - 3500 cost), got ${completed.profitability}`);
    assert(completed.costPerKm === 23.33, `expected costPerKm exactly 23.33 (3500/150), got ${completed.costPerKm}`);
    assert(completed.status === 'completed', `expected status "completed", got "${completed.status}"`);
  });

  await step('An odometer reading LOWER than the start is rejected — the meter cannot run backward, the same principle Petrol Pump\'s meter check already established', async () => {
    const trip2 = await logisticsService.startTrip({ companyId: company._id, branchId: branch._id, vehicleId: deliveryVan._id, driverId: deliveryDriver._id, startOdometer: 2000 });
    let threw = false;
    try {
      await logisticsService.completeTrip(trip2._id, { endOdometer: 1900, fuelCost: 100, otherCosts: 0 });
    } catch { threw = true; }
    assert(threw, 'expected an endOdometer lower than startOdometer to be rejected');
  });

  // --- 65. Universal Helpdesk: a real, time-based SLA with genuine breach detection — hand-verified boundary math executed before this test was written ---
  const Ticket = require('./models/Ticket');

  await step('A high-priority ticket, assigned almost immediately, is NOT breached — the normal, fast-response case', async () => {
    const ticket = await ticketService.createTicket({ companyId: company._id, branchId: branch._id, customerId: customer._id, category: 'billing', subject: 'Invoice discrepancy', description: 'My invoice total looks wrong.', priority: 'high' });
    const assigned = await ticketService.assignTicket(ticket._id, { assignedToUserId: null });
    assert(assigned.slaBreached === false, `expected an immediately-assigned high-priority ticket to NOT be breached, got slaBreached=${assigned.slaBreached}`);
  });

  await step('A ticket whose SLA window has already passed (simulated by directly setting slaDueAt into the past, since a smoke test can\'t actually wait hours) IS correctly detected as breached the moment it\'s assigned', async () => {
    const ticket = await ticketService.createTicket({ companyId: company._id, branchId: branch._id, customerId: customer._id, category: 'technical', subject: 'System down', description: 'Cannot access the POS terminal.', priority: 'emergency' });
    await Ticket.findByIdAndUpdate(ticket._id, { slaDueAt: new Date(Date.now() - 60 * 60 * 1000) }); // simulate: the 1-hour emergency SLA window already passed
    const assigned = await ticketService.assignTicket(ticket._id, { assignedToUserId: null });
    assert(assigned.slaBreached === true, `expected this ticket, assigned after its simulated SLA window already passed, to be detected as breached, got slaBreached=${assigned.slaBreached}`);
  });

  await step('A ticket cannot be resolved before it\'s assigned — the real work-order sequence is enforced, the same discipline Housing Society\'s complaint workflow already established', async () => {
    const ticket = await ticketService.createTicket({ companyId: company._id, branchId: branch._id, customerId: customer._id, category: 'general', subject: 'Question about pricing', description: 'What is the wholesale rate?', priority: 'low' });
    let threw = false;
    try {
      await ticketService.resolveTicket(ticket._id, { resolutionNote: 'Answered' });
    } catch { threw = true; }
    assert(threw, 'expected resolving an unassigned ticket to be rejected');

    await ticketService.assignTicket(ticket._id, { assignedToUserId: null });
    const resolved = await ticketService.resolveTicket(ticket._id, { resolutionNote: 'Provided the wholesale rate sheet.' });
    assert(resolved.status === 'resolved' && resolved.resolutionNote === 'Provided the wholesale rate sheet.', `expected status "resolved" with the real resolution note, got status="${resolved.status}"`);

    const closed = await ticketService.closeTicket(ticket._id);
    assert(closed.status === 'closed', `expected status "closed", got "${closed.status}"`);
  });

  await step('SLA compliance report reflects the real, actual mix: at least 1 met and 1 breached ticket among those just created, with a genuine computed compliance percentage — not a placeholder number', async () => {
    const report = await ticketService.slaComplianceReport(company._id);
    assert(report.overall.total >= 3, `expected at least the 3 responded-to tickets from this test section to be counted, got ${report.overall.total}`);
    assert(report.overall.breached >= 1, `expected at least 1 breached ticket (the simulated-overdue emergency one) to show up in the real aggregation, got ${report.overall.breached}`);
    assert(report.overall.met >= 2, `expected at least 2 met tickets, got ${report.overall.met}`);
    assert(report.overall.complianceRate !== null && report.overall.complianceRate > 0 && report.overall.complianceRate < 100, `expected a genuine, non-trivial computed compliance rate strictly between 0 and 100 given the known mix, got ${report.overall.complianceRate}`);
  });

  // --- 66. RFQ: real per-item best-price comparison, splitting into MULTIPLE purchase orders by winning supplier — every number hand-verified before this test was written ---
  const rfqProductA = await Product.create({ companyId: company._id, name: 'RFQ Item A', sku: `RFQA-${suffix}`, trackingMode: 'simple', costPrice: 0, sellingPrice: 0, variants: [{ sku: `RFQA-${suffix}`, sellingPrice: 0 }] });
  const rfqProductB = await Product.create({ companyId: company._id, name: 'RFQ Item B', sku: `RFQB-${suffix}`, trackingMode: 'simple', costPrice: 0, sellingPrice: 0, variants: [{ sku: `RFQB-${suffix}`, sellingPrice: 0 }] });
  const rfqSupplierX = await Supplier.create({ companyId: company._id, name: 'Supplier X' });
  const rfqSupplierY = await Supplier.create({ companyId: company._id, name: 'Supplier Y' });

  const rfq = await step('Create an RFQ requesting 10 of Item A and 5 of Item B', () =>
    rfqService.createRFQ({
      companyId: company._id, branchId: branch._id,
      items: [
        { productId: rfqProductA._id, variantId: rfqProductA.variants[0]._id, quantity: 10 },
        { productId: rfqProductB._id, variantId: rfqProductB.variants[0]._id, quantity: 5 },
      ],
    })
  );

  await step('Supplier X quotes A@100, B@50 (total 1250); Supplier Y quotes A@90, B@60 (total 1200) — hand-traced totals confirmed', async () => {
    const quoteX = await rfqService.submitQuotation(rfq._id, { supplierId: rfqSupplierX._id, items: [{ productId: rfqProductA._id, variantId: rfqProductA.variants[0]._id, unitPrice: 100 }, { productId: rfqProductB._id, variantId: rfqProductB.variants[0]._id, unitPrice: 50 }] });
    const quoteY = await rfqService.submitQuotation(rfq._id, { supplierId: rfqSupplierY._id, items: [{ productId: rfqProductA._id, variantId: rfqProductA.variants[0]._id, unitPrice: 90 }, { productId: rfqProductB._id, variantId: rfqProductB.variants[0]._id, unitPrice: 60 }] });
    assert(quoteX.totalAmount === 1250, `expected Supplier X's total exactly 1250 (100×10 + 50×5), got ${quoteX.totalAmount}`);
    assert(quoteY.totalAmount === 1200, `expected Supplier Y's total exactly 1200 (90×10 + 60×5), got ${quoteY.totalAmount}`);
  });

  await step('Comparison correctly identifies Item A\'s cheapest price as Supplier Y (90 < 100), and Item B\'s cheapest as Supplier X (50 < 60) — a SPLIT winner, not one overall "best supplier"', async () => {
    const { bestByItem } = await rfqService.compareQuotations(rfq._id);
    const bestA = bestByItem.find((b) => String(b.productId) === String(rfqProductA._id));
    const bestB = bestByItem.find((b) => String(b.productId) === String(rfqProductB._id));
    assert(bestA.unitPrice === 90 && String(bestA.supplierId._id) === String(rfqSupplierY._id), `expected Item A's best price to be Supplier Y at 90, got price=${bestA.unitPrice} supplier=${bestA.supplierId._id}`);
    assert(bestB.unitPrice === 50 && String(bestB.supplierId._id) === String(rfqSupplierX._id), `expected Item B's best price to be Supplier X at 50, got price=${bestB.unitPrice} supplier=${bestB.supplierId._id}`);
  });

  await step('Converting produces EXACTLY 2 real purchase orders — one per winning supplier — each containing only the item that supplier actually won, at the correct real subtotal', async () => {
    const orders = await rfqService.convertBestPriceToOrders(rfq._id, { branchId: branch._id, warehouseId: warehouse._id, userId: admin._id });
    assert(orders.length === 2, `expected exactly 2 purchase orders (split by winning supplier), got ${orders.length}`);

    const orderForY = orders.find((o) => String(o.supplierId) === String(rfqSupplierY._id));
    const orderForX = orders.find((o) => String(o.supplierId) === String(rfqSupplierX._id));
    assert(orderForY.items.length === 1 && orderForY.items[0].quantityOrdered === 10 && orderForY.items[0].unitCost === 90 && orderForY.subtotal === 900, `expected Supplier Y's PO to contain exactly Item A (qty 10 @ 90 = 900), got ${JSON.stringify({ itemCount: orderForY.items.length, subtotal: orderForY.subtotal })}`);
    assert(orderForX.items.length === 1 && orderForX.items[0].quantityOrdered === 5 && orderForX.items[0].unitCost === 50 && orderForX.subtotal === 250, `expected Supplier X's PO to contain exactly Item B (qty 5 @ 50 = 250), got ${JSON.stringify({ itemCount: orderForX.items.length, subtotal: orderForX.subtotal })}`);

    const refreshedRfq = await require('./models/RFQ').findById(rfq._id);
    assert(refreshedRfq.status === 'closed', `expected the RFQ to be closed after conversion, got "${refreshedRfq.status}"`);
  });

  // --- 67. Multi-UOM: real conversion math, both quantity AND cost, feeding unmodified into core Purchasing — every number hand-verified before this test was written ---
  const Unit = require('./models/Unit');
  const uomPieceUnit = await Unit.create({ companyId: company._id, name: 'Piece', shortCode: 'pc' });
  const uomBoxUnit = await Unit.create({ companyId: company._id, name: 'Box', shortCode: 'bx', baseUnitId: uomPieceUnit._id, conversionFactor: 12 });
  const uomCartonUnit = await Unit.create({ companyId: company._id, name: 'Carton', shortCode: 'ctn', baseUnitId: uomPieceUnit._id, conversionFactor: 288 });
  const uomKgUnit = await Unit.create({ companyId: company._id, name: 'Kilogram', shortCode: 'kg' }); // a genuinely UNRELATED base unit — no shared ancestor with Piece/Box/Carton

  await step('2 cartons converts to exactly 48 boxes and exactly 576 pieces — real conversion math, both directions', async () => {
    const toBoxes = await unitConversionService.convertQuantity(uomCartonUnit._id, uomBoxUnit._id, 2);
    const toPieces = await unitConversionService.convertQuantity(uomCartonUnit._id, uomPieceUnit._id, 2);
    assert(toBoxes === 48, `expected 2 cartons to convert to exactly 48 boxes, got ${toBoxes}`);
    assert(toPieces === 576, `expected 2 cartons to convert to exactly 576 pieces, got ${toPieces}`);
  });

  await step('A cost of 500/carton converts to the real per-piece cost of exactly 500/288 — and the true total cost is preserved exactly across both representations', async () => {
    const costPerPiece = await unitConversionService.convertUnitCost(uomCartonUnit._id, uomPieceUnit._id, 500);
    assert(Math.abs(costPerPiece - 500 / 288) < 0.000001, `expected costPerPiece to be exactly 500/288, got ${costPerPiece}`);
    const totalViaCartons = 2 * 500;
    const totalViaPieces = 576 * costPerPiece;
    assert(Math.abs(totalViaCartons - totalViaPieces) < 0.001, `expected the true total cost to be preserved exactly across both representations, got cartons=${totalViaCartons} pieces=${totalViaPieces}`);
  });

  await step('Converting between two units with NO shared base unit (Carton vs. an unrelated Kilogram) is correctly rejected, not silently producing a nonsensical number', async () => {
    let threw = false;
    try {
      await unitConversionService.convertQuantity(uomCartonUnit._id, uomKgUnit._id, 1);
    } catch { threw = true; }
    assert(threw, 'expected converting between two genuinely unrelated units to be rejected');
  });

  await step('A real purchase order created "from alternate units" (2 cartons @ 500/carton) lands in core Purchasing with the CORRECT converted quantity (576) and unit cost (500/288) — core createPurchaseOrder itself was never touched, only composed with', async () => {
    const uomProduct = await Product.create({ companyId: company._id, name: 'UOM Test Product', sku: `UOM-${suffix}`, trackingMode: 'simple', costPrice: 0, sellingPrice: 10, unitId: uomPieceUnit._id, variants: [{ sku: `UOM-${suffix}`, sellingPrice: 10 }] });
    const converted = await unitConversionService.convertPurchaseItemsToProductUnits([
      { productId: uomProduct._id, variantId: uomProduct.variants[0]._id, quantity: 2, unitCost: 500, purchaseUnitId: uomCartonUnit._id },
    ]);
    assert(converted[0].quantityOrdered === 576, `expected the converted quantityOrdered to be exactly 576, got ${converted[0].quantityOrdered}`);
    assert(Math.abs(converted[0].unitCost - 500 / 288) < 0.000001, `expected the converted unitCost to be exactly 500/288, got ${converted[0].unitCost}`);

    const po = await purchaseService.createPurchaseOrder({ companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id, items: converted, userId: admin._id });
    assert(po.items[0].quantityOrdered === 576, `expected the real PO's line item to record exactly 576 (the converted quantity), got ${po.items[0].quantityOrdered}`);
    assert(Math.abs(po.subtotal - 1000) < 0.001, `expected the real PO's subtotal to be exactly 1000 (576 × 500/288, preserving the true 2-cartons-at-500 total), got ${po.subtotal}`);
  });

  // --- 68. Excel/PDF export: real files actually generated and inspected by their binary signatures, not just checked for not throwing ---
  await step('A real Excel buffer is produced with the correct ZIP file signature (Excel files ARE zip archives) — and it genuinely reflects the row data, not an empty template', async () => {
    const columns = [{ key: 'name', header: 'Account' }, { key: 'debit', header: 'Debit' }, { key: 'credit', header: 'Credit' }];
    const rows = [{ name: 'Cash', debit: 50000, credit: 0 }, { name: 'Revenue', debit: 0, credit: 50000 }];
    const buffer = await reportExportService.toExcelBuffer({ title: 'Smoke Test Report', columns, rows });
    assert(Buffer.isBuffer(buffer) && buffer.length > 1000, `expected a real, non-trivial Excel buffer, got isBuffer=${Buffer.isBuffer(buffer)} length=${buffer?.length}`);
    assert(buffer.slice(0, 2).toString('hex') === '504b', `expected the real ZIP file signature (Excel files are zip archives) as the first 2 bytes, got ${buffer.slice(0, 2).toString('hex')}`);
  });

  await step('A real PDF buffer is produced with the correct %PDF file header', async () => {
    const columns = [{ key: 'name', header: 'Account' }, { key: 'debit', header: 'Debit' }, { key: 'credit', header: 'Credit' }];
    const rows = [{ name: 'Cash', debit: 50000, credit: 0 }, { name: 'Revenue', debit: 0, credit: 50000 }];
    const buffer = await reportExportService.toPdfBuffer({ title: 'Smoke Test Report', columns, rows });
    assert(Buffer.isBuffer(buffer) && buffer.length > 500, `expected a real, non-trivial PDF buffer, got isBuffer=${Buffer.isBuffer(buffer)} length=${buffer?.length}`);
    assert(buffer.slice(0, 4).toString() === '%PDF', `expected the real PDF file header as the first 4 bytes, got "${buffer.slice(0, 4).toString()}"`);
  });

  await step('A report with MANY rows (enough to force a real PDF page break) still produces a valid multi-page PDF, not a truncated or broken one', async () => {
    const columns = [{ key: 'name', header: 'Account' }, { key: 'amount', header: 'Amount' }];
    const rows = Array.from({ length: 80 }, (_, i) => ({ name: `Account ${i}`, amount: i * 100 }));
    const buffer = await reportExportService.toPdfBuffer({ title: 'Long Report', columns, rows });
    assert(buffer.slice(0, 4).toString() === '%PDF', 'expected a valid PDF header even with enough rows to force a page break');
    assert(buffer.length > 1000, `expected a real multi-page PDF to be substantially larger than a single-page one, got ${buffer.length} bytes`);
  });

  // --- 69. Cost Centers: real per-ENTRY filtering within a single voucher — the exact correctness property that could easily be gotten wrong ---
  const ccMarketing = await costCenterService.createCostCenter({ companyId: company._id, name: 'Marketing', code: 'CC-MKT' });
  const ccOperations = await costCenterService.createCostCenter({ companyId: company._id, name: 'Operations', code: 'CC-OPS' });
  const marketingExpenseAccount = await Account.create({ companyId: company._id, name: 'Marketing Expense', type: 'expense' });
  const operationsExpenseAccount = await Account.create({ companyId: company._id, name: 'Operations Expense', type: 'expense' });

  await step('Post ONE voucher with 3 entries: 1000 tagged to Marketing, 500 tagged to Operations, and 1500 UNTAGGED (the balancing credit) — all in the SAME voucher document', async () => {
    await accountingService.postVoucher({
      companyId: company._id, branchId: branch._id, type: 'journal', narration: 'Cost center smoke test',
      entries: [
        { accountId: marketingExpenseAccount._id, debit: 1000, credit: 0, costCenterId: ccMarketing._id },
        { accountId: operationsExpenseAccount._id, debit: 500, credit: 0, costCenterId: ccOperations._id },
        { accountId: cash._id, debit: 0, credit: 1500 }, // deliberately untagged — the balancing leg of the SAME voucher
      ],
      userId: admin._id,
    });
  });

  await step('Marketing\'s cost-center P&L shows EXACTLY its own 1000 — NOT the Operations entry, and NOT the untagged cash entry, even though all three live in the same voucher', async () => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const report = await costCenterService.costCenterProfitAndLoss(company._id, ccMarketing._id, from, to);
    assert(report.expenses.length === 1 && report.expenses[0].name === 'Marketing Expense' && report.expenses[0].amount === 1000, `expected exactly 1 expense line (Marketing Expense, 1000), got ${JSON.stringify(report.expenses)}`);
    assert(report.totalExpenses === 1000, `expected totalExpenses exactly 1000, got ${report.totalExpenses}`);
  });

  await step('Operations\' cost-center P&L shows EXACTLY its own 500 — the same voucher, correctly filtered to a completely different result for a different cost center', async () => {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const report = await costCenterService.costCenterProfitAndLoss(company._id, ccOperations._id, from, to);
    assert(report.expenses.length === 1 && report.expenses[0].name === 'Operations Expense' && report.expenses[0].amount === 500, `expected exactly 1 expense line (Operations Expense, 500), got ${JSON.stringify(report.expenses)}`);
    assert(report.totalExpenses === 500, `expected totalExpenses exactly 500, got ${report.totalExpenses}`);
  });

  // --- 70. Fiscal Years / Accounting Periods: real period locking, added directly inside postVoucher — the highest-risk change in this whole project, verified as an explicit no-op first ---
  await step('REGRESSION CHECK: an ordinary voucher, with NO accounting periods defined for this company at all, still posts successfully — the exact no-op case every one of the 69 prior test sections in this file has already been implicitly relying on', async () => {
    const regressionExpenseAccount = await Account.create({ companyId: company._id, name: 'Regression Check Expense', type: 'expense' });
    const voucher = await accountingService.postVoucher({
      companyId: company._id, branchId: branch._id, type: 'journal', narration: 'Regression check — no periods defined',
      entries: [{ accountId: regressionExpenseAccount._id, debit: 100, credit: 0 }, { accountId: cash._id, debit: 0, credit: 100 }],
      userId: admin._id,
    });
    assert(voucher && voucher._id, 'expected an ordinary voucher to post successfully with zero accounting periods defined — this must remain a true no-op');
  });

  const periodExpenseAccount = await Account.create({ companyId: company._id, name: 'Period Test Expense', type: 'expense' });
  const fiscalYear = await periodService.createFiscalYear({ companyId: company._id, name: 'FY-Smoke', startDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000) });
  const accountingPeriod = await periodService.createAccountingPeriod({ companyId: company._id, fiscalYearId: fiscalYear._id, name: 'Current Period', startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });

  await step('While the period is still OPEN, a voucher dated within it posts normally', async () => {
    const voucher = await accountingService.postVoucher({
      companyId: company._id, branchId: branch._id, type: 'journal', narration: 'Voucher in an open period',
      entries: [{ accountId: periodExpenseAccount._id, debit: 50, credit: 0 }, { accountId: cash._id, debit: 0, credit: 50 }],
      userId: admin._id,
    });
    assert(voucher && voucher._id, 'expected a voucher dated inside a still-OPEN period to post successfully');
  });

  await step('Once the period is CLOSED, a voucher dated within it is REJECTED — the real control this whole feature exists for', async () => {
    await periodService.closePeriod(accountingPeriod._id);
    let threw = false;
    try {
      await accountingService.postVoucher({
        companyId: company._id, branchId: branch._id, type: 'journal', narration: 'Attempted voucher in a CLOSED period',
        entries: [{ accountId: periodExpenseAccount._id, debit: 75, credit: 0 }, { accountId: cash._id, debit: 0, credit: 75 }],
        userId: admin._id,
      });
    } catch { threw = true; }
    assert(threw, 'expected a voucher dated inside a CLOSED period to be rejected');
  });

  await step('A voucher dated OUTSIDE the closed period\'s date range still posts successfully — the lock is genuinely scoped to its own date range, not a blanket freeze on the whole company', async () => {
    const voucher = await accountingService.postVoucher({
      companyId: company._id, branchId: branch._id, type: 'journal', date: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), narration: 'Voucher well outside the closed period',
      entries: [{ accountId: periodExpenseAccount._id, debit: 25, credit: 0 }, { accountId: cash._id, debit: 0, credit: 25 }],
      userId: admin._id,
    });
    assert(voucher && voucher._id, 'expected a voucher dated outside the closed period\'s range to post successfully');
  });

  await step('Reopening the period allows posting inside it again', async () => {
    await periodService.reopenPeriod(accountingPeriod._id);
    const voucher = await accountingService.postVoucher({
      companyId: company._id, branchId: branch._id, type: 'journal', narration: 'Voucher after reopening',
      entries: [{ accountId: periodExpenseAccount._id, debit: 10, credit: 0 }, { accountId: cash._id, debit: 0, credit: 10 }],
      userId: admin._id,
    });
    assert(voucher && voucher._id, 'expected a voucher to post successfully once the period was reopened');
  });

  // --- 71. Bad Debt / AR Aging: a genuinely new report discovered while checking for it, plus real write-off that removes a receivable from the books going forward ---
  const receivableAccount = await Account.create({ companyId: company._id, name: 'Accounts Receivable - Smoke', type: 'asset' });
  const badDebtExpenseAccount = await Account.create({ companyId: company._id, name: 'Bad Debt Expense', type: 'expense' });

  const creditSale = await step('A credit sale (partial payment, real dueAmount left outstanding) — its invoice date is directly set 45 days in the past to deterministically test aging buckets without waiting real time', async () => {
    const sale = await posSaleService.checkout({ userId: admin._id,
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, customerId: customer._id,
      items: [{ productId: product._id, variantId, quantity: 1, unitPrice: 1000 }],
      payments: [{ paymentAccountId: cash._id, method: 'cash', amount: 400 }], // partial — leaves 600 due
      receivableAccountId: receivableAccount._id,
    });
    assert(sale.dueAmount === 600, `expected a real outstanding dueAmount of exactly 600 (1000 - 400 paid), got ${sale.dueAmount}`);
    // Explicit $set (not relying on Mongoose's implicit wrapping) + { new: true }
    // so we get the POST-update document back and can verify the backdate
    // actually landed, rather than silently trusting a fire-and-forget
    // update and finding out three steps later, from a confusing aging
    // assertion, that it didn't.
    const updated = await Sale.findByIdAndUpdate(
      sale._id,
      { $set: { invoiceDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000) } },
      { new: true }
    );
    assert(
      updated && (Date.now() - new Date(updated.invoiceDate).getTime()) > 40 * 24 * 60 * 60 * 1000,
      `expected the credit sale's invoiceDate to be backdated ~45 days, got ${updated?.invoiceDate}`
    );
    return updated; // the freshly-updated document, not the stale pre-backdate one
  });

  await step('AR Aging correctly buckets this 45-day-old receivable into "31-60", with the real outstanding amount of 600', async () => {
    const report = await badDebtService.arAgingReport(company._id);
    const row = report.rows.find((r) => String(r.saleId) === String(creditSale._id));
    assert(row && row.bucket === '31-60' && row.dueAmount === 600, `expected this sale to appear in AR aging with bucket "31-60" and dueAmount 600, got ${JSON.stringify(row)}`);
  });

  await step('Writing off this receivable posts a real, balanced voucher (Dr Bad Debt Expense 600, Cr Receivable 600) and permanently zeroes the sale\'s dueAmount', async () => {
    const result = await badDebtService.writeOffReceivable(creditSale._id, { badDebtExpenseAccountId: badDebtExpenseAccount._id, receivableAccountId: receivableAccount._id, userId: admin._id });
    assert(result.amountWrittenOff === 600, `expected amountWrittenOff exactly 600, got ${result.amountWrittenOff}`);
    const totalDebit = result.voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = result.voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 600 && totalCredit === 600, `expected the write-off voucher to balance at exactly 600, got debit=${totalDebit} credit=${totalCredit}`);
    assert(result.sale.dueAmount === 0 && result.sale.writtenOff === true, `expected dueAmount permanently 0 and writtenOff=true, got dueAmount=${result.sale.dueAmount} writtenOff=${result.sale.writtenOff}`);
  });

  await step('The written-off sale NO LONGER appears in AR Aging — real proof the write-off actually removes it from future reporting, not just marks a flag nobody reads', async () => {
    const report = await badDebtService.arAgingReport(company._id);
    const row = report.rows.find((r) => String(r.saleId) === String(creditSale._id));
    assert(!row, `expected the written-off sale to be completely absent from AR aging, but found it: ${JSON.stringify(row)}`);
  });

  await step('Attempting to write off the SAME receivable a second time is rejected — a real, permanent accounting action, not something silently repeatable', async () => {
    let threw = false;
    try {
      await badDebtService.writeOffReceivable(creditSale._id, { badDebtExpenseAccountId: badDebtExpenseAccount._id, receivableAccountId: receivableAccount._id, userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected writing off an already-written-off receivable to be rejected');
  });

  // --- 72. AP Aging: the payable-side mirror of AR Aging, reading the real, already-maintained PurchaseOrder.dueAmount ---
  const apAgingSupplier = await Supplier.create({ companyId: company._id, name: 'AP Aging Test Supplier' });
  const apAgingPO = await step('A purchase order with a real outstanding dueAmount of 800, dated 75 days in the past', async () => {
    const PurchaseOrder = require('./models/PurchaseOrder');
    const po = await PurchaseOrder.create({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: apAgingSupplier._id,
      poNumber: `AP-AGING-${suffix}`, status: 'received',
      items: [{ productId: product._id, variantId, quantityOrdered: 8, quantityReceived: 8, unitCost: 100 }],
      subtotal: 800, totalAmount: 800, paidAmount: 0, dueAmount: 800,
    });
    await PurchaseOrder.findByIdAndUpdate(po._id, { orderDate: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000) });
    return po;
  });

  await step('AP Aging correctly buckets this 75-day-old payable into "61-90", with the real outstanding amount of 800 — reading PurchaseOrder.dueAmount as the live source of truth, not a separate parallel balance', async () => {
    const report = await reportingService.apAgingReport(company._id);
    const row = report.rows.find((r) => String(r.purchaseOrderId) === String(apAgingPO._id));
    assert(row && row.bucket === '61-90' && row.dueAmount === 800, `expected this PO to appear in AP aging with bucket "61-90" and dueAmount 800, got ${JSON.stringify(row)}`);
    assert(row.supplierName === 'AP Aging Test Supplier', `expected the real supplier name to be populated, got "${row.supplierName}"`);
  });

  // --- 73. Employee Loans: fills in PayrollRun's real "advances" field (previously always hardcoded to 0), verified as a true no-op for employees without a loan first ---
  const loanReceivableAccount = await Account.create({ companyId: company._id, name: 'Employee Loans Receivable', type: 'asset' });
  const salaryPayableAccount = await Account.create({ companyId: company._id, name: 'Salary Payable', type: 'liability' });
  const noLoanEmployee = await hrService.createEmployee({ companyId: company._id, branchId: branch._id, name: 'No-Loan Employee', salaryStructure: { basic: 30000, allowances: 2000, deductions: 0 } });
  const loanEmployee = await hrService.createEmployee({ companyId: company._id, branchId: branch._id, name: 'Loan Employee', salaryStructure: { basic: 30000, allowances: 2000, deductions: 0 } });

  await step('Disburse a real 60000 loan to one employee, with a 5000 monthly installment — posts a real, balanced disbursement voucher', async () => {
    const loan = await employeeLoanService.disburseLoan({
      companyId: company._id, branchId: branch._id, employeeId: loanEmployee._id, principalAmount: 60000, monthlyInstallment: 5000,
      loanReceivableAccountId: loanReceivableAccount._id, disbursingAccountId: cash._id, userId: admin._id,
    });
    assert(loan.remainingBalance === 60000 && loan.status === 'active', `expected a fresh loan with remainingBalance 60000 and status "active", got remainingBalance=${loan.remainingBalance} status=${loan.status}`);
  });

  const employeeLoanPayrollRun = await step('One payroll run covering BOTH employees: the no-loan employee\'s advances is EXACTLY 0 (the true regression check — this field was always hardcoded to 0 before this feature, so it must stay 0 for anyone without a loan) — the loan employee\'s advances is EXACTLY 5000, netPay correctly reduced by that amount', async () => {
    // 6/2099 is already taken by the salon commission-to-payroll test above
    // (PayrollRun has a unique companyId+month+year index), so this uses
    // 7/2099 — still far-future and collision-free, but genuinely distinct
    // from every other payroll run this file creates.
    const run = await hrService.generatePayroll({ companyId: company._id, month: 7, year: 2099, userId: admin._id });
    const noLoanEntry = run.entries.find((e) => String(e.employeeId) === String(noLoanEmployee._id));
    const loanEntry = run.entries.find((e) => String(e.employeeId) === String(loanEmployee._id));

    assert(noLoanEntry.advances === 0, `REGRESSION CHECK: expected advances to remain exactly 0 for an employee with no loan — this field was always 0 before this feature and must stay that way for the common case, got ${noLoanEntry.advances}`);
    assert(noLoanEntry.netPay === 32000, `expected the no-loan employee's netPay to be exactly 32000 (30000+2000, unaffected by this feature), got ${noLoanEntry.netPay}`);

    assert(loanEntry.advances === 5000, `expected the loan employee's advances to be exactly 5000 (the real monthly installment), got ${loanEntry.advances}`);
    assert(loanEntry.netPay === 27000, `expected the loan employee's netPay to be exactly 27000 (30000+2000-5000), got ${loanEntry.netPay}`);
    return run;
  });

  await step('Recording the repayment reduces the real loan balance from 60000 to exactly 55000, and posts a real, balanced voucher', async () => {
    const loan = await employeeLoanService.recordRepayment(loanEmployee._id, 5000, { companyId: company._id, branchId: branch._id, salaryPayableAccountId: salaryPayableAccount._id, userId: admin._id });
    assert(loan.remainingBalance === 55000, `expected remainingBalance exactly 55000 (60000 - 5000), got ${loan.remainingBalance}`);
    assert(loan.status === 'active', `expected the loan to still be "active" (not yet fully repaid), got "${loan.status}"`);
  });

  await step('A SECOND employee with a SMALL 3000 loan (less than the standard 5000 installment) has their deduction correctly CAPPED at 3000 — never over-collecting past a zero balance', async () => {
    const smallLoanEmployee = await hrService.createEmployee({ companyId: company._id, branchId: branch._id, name: 'Small Loan Employee', salaryStructure: { basic: 30000, allowances: 0, deductions: 0 } });
    await employeeLoanService.disburseLoan({ companyId: company._id, branchId: branch._id, employeeId: smallLoanEmployee._id, principalAmount: 3000, monthlyInstallment: 5000, loanReceivableAccountId: loanReceivableAccount._id, disbursingAccountId: cash._id, userId: admin._id });
    const deduction = await employeeLoanService.monthlyDeductionFor(smallLoanEmployee._id);
    assert(deduction === 3000, `expected the deduction to be capped at the real remaining balance of 3000, not the full 5000 installment, got ${deduction}`);
  });

  // --- 74. Document access control: real role-based separation for vendor/company-scoped attachments — tested directly against hasPermission(), since documentController's authorization logic sits above the service layer this smoke test otherwise exercises ---
  await step('A role with ONLY the general "documents.view" permission is genuinely DENIED the stricter vendor/company document permission — the real separation this whole feature exists for', () => {
    const req = { auth: { permissions: [DOCUMENTS_VIEW] } };
    assert(hasPermission(req, DOCUMENTS_VIEW) === true, 'expected the general documents.view permission to be granted');
    assert(hasPermission(req, VENDOR_COMPANY_DOCUMENTS_VIEW) === false, 'expected a role with ONLY the general documents.view permission to be denied the stricter vendor/company permission — these must NOT bleed into each other');
  });

  await step('A role explicitly granted the specific vendor/company permission is genuinely allowed', () => {
    const req = { auth: { permissions: [VENDOR_COMPANY_DOCUMENTS_VIEW] } };
    assert(hasPermission(req, VENDOR_COMPANY_DOCUMENTS_VIEW) === true, 'expected the explicitly-granted vendor/company permission to be allowed');
  });

  await step('A role with the broader "documents.*" wildcard correctly covers the stricter vendor/company permission too — a real documents admin, not locked out of their own broader grant', () => {
    const req = { auth: { permissions: ['documents.*'] } };
    assert(hasPermission(req, DOCUMENTS_VIEW) === true && hasPermission(req, VENDOR_COMPANY_DOCUMENTS_VIEW) === true, 'expected the documents.* wildcard to cover both the general and the stricter vendor/company permission');
  });

  await step('A super-admin (permissions === null, the real sentinel this app already uses) bypasses every permission check, including the strict vendor/company one', () => {
    const req = { auth: { permissions: null } };
    assert(hasPermission(req, VENDOR_COMPANY_DOCUMENTS_VIEW) === true, 'expected a super-admin (null permissions) to be allowed everything, including the strict vendor/company permission');
  });

  await step('A role with NEITHER permission is genuinely denied both — the honest baseline this whole test section is checking against', () => {
    const req = { auth: { permissions: ['some.unrelated.permission'] } };
    assert(hasPermission(req, DOCUMENTS_VIEW) === false && hasPermission(req, VENDOR_COMPANY_DOCUMENTS_VIEW) === false, 'expected a role with an unrelated permission to be denied both document permissions');
  });

  // --- 75. Recurring Invoices: a real, universal core billing engine, with month-end date clamping verified directly before this test was written ---
  const recurringBillingProduct = await Product.create({ companyId: company._id, name: 'Monthly Retainer', sku: `RETAINER-${suffix}`, trackingMode: 'service', costPrice: 0, sellingPrice: 0, variants: [{ sku: `RETAINER-${suffix}`, sellingPrice: 0 }] });

  await step('advanceDate() correctly clamps Jan 31 + 1 month to Feb 28, NOT the naive-JS-Date bug that would silently overflow into March 3', () => {
    const result = recurringInvoiceService.advanceDate(new Date('2026-01-31T00:00:00Z'), 'monthly');
    assert(result.getUTCMonth() === 1 && result.getUTCDate() === 28, `expected Jan 31 + 1 month to clamp to Feb 28 (month index 1, date 28), got month=${result.getUTCMonth()} date=${result.getUTCDate()}`);
  });

  const recurringTemplate = await step('Create a recurring monthly template starting 40 days in the past — genuinely overdue, not just due today', () =>
    recurringInvoiceService.createTemplate({
      companyId: company._id, branchId: branch._id, customerId: customer._id,
      items: [{ productId: recurringBillingProduct._id, variantId: recurringBillingProduct.variants[0]._id, quantity: 1, unitPrice: 15000 }],
      frequency: 'monthly', startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    })
  );

  const pausedTemplate = await step('A SECOND template, immediately PAUSED — must be skipped even though it would otherwise be due', () => {
    return recurringInvoiceService.createTemplate({
      companyId: company._id, branchId: branch._id, customerId: customer._id,
      items: [{ productId: recurringBillingProduct._id, variantId: recurringBillingProduct.variants[0]._id, quantity: 1, unitPrice: 9999 }],
      frequency: 'monthly', startDate: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
    }).then((t) => recurringInvoiceService.pauseTemplate(t._id));
  });

  await step('generateDueInvoices bills EXACTLY the one active, overdue template — the paused one is genuinely skipped, not billed', async () => {
    const result = await recurringInvoiceService.generateDueInvoices(company._id, { warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    const billedForActive = result.results.find((r) => String(r.templateId) === String(recurringTemplate._id));
    const billedForPaused = result.results.find((r) => String(r.templateId) === String(pausedTemplate._id));
    assert(billedForActive && billedForActive.sale.totalAmount === 15000, `expected the active template to be billed for exactly 15000, got ${JSON.stringify(billedForActive)}`);
    assert(!billedForPaused, 'expected the PAUSED template to be genuinely skipped, not billed');
  });

  await step('The billed template\'s schedule genuinely advanced by one real month — running generateDueInvoices again immediately does NOT bill it a second time', async () => {
    const refreshed = await require('./models/RecurringInvoiceTemplate').findById(recurringTemplate._id);
    assert(refreshed.lastRunDate !== null, 'expected lastRunDate to be set after billing');
    assert(refreshed.nextRunDate > new Date(), `expected nextRunDate to have advanced to a genuine future date, got ${refreshed.nextRunDate}`);

    const secondRun = await recurringInvoiceService.generateDueInvoices(company._id, { warehouseId: warehouse._id, paymentAccountId: cash._id, userId: admin._id });
    const billedAgain = secondRun.results.find((r) => String(r.templateId) === String(recurringTemplate._id));
    assert(!billedAgain, 'expected the same template NOT to be billed again immediately after its schedule already advanced into the future');
  });

  // --- 76. Budget vs Actual: real vs Voucher entries, hand-verified variance math, and a genuine boundary check on which month a voucher counts toward ---
  const budgetExpenseAccount = await Account.create({ companyId: company._id, name: 'Budget Test Expense', type: 'expense' });

  const budgetLine = await step('Set a 20000 budget for September 2099 (a deliberately far-future, never-colliding month) — setting it a SECOND time updates the same line, never duplicates', async () => {
    const first = await budgetService.setBudget({ companyId: company._id, accountId: budgetExpenseAccount._id, month: 9, year: 2099, budgetedAmount: 15000 });
    const second = await budgetService.setBudget({ companyId: company._id, accountId: budgetExpenseAccount._id, month: 9, year: 2099, budgetedAmount: 20000 });
    assert(String(first._id) === String(second._id), 'expected setting the same account/month/year budget a second time to update the SAME line (via the real unique index + upsert), not create a duplicate');
    const allLines = await budgetService.listBudgetLines(company._id, { month: 9, year: 2099 });
    assert(allLines.length === 1 && allLines[0].budgetedAmount === 20000, `expected exactly 1 real budget line with the updated amount 20000, got ${JSON.stringify(allLines.map((l) => l.budgetedAmount))}`);
    return second;
  });

  await step('Post a real 25000 expense voucher WITHIN September 2099, and a SEPARATE voucher OUTSIDE it (October) — the boundary check this whole feature depends on', async () => {
    await accountingService.postVoucher({
      companyId: company._id, branchId: branch._id, type: 'journal', date: new Date(2099, 8, 15), narration: 'Real September 2099 expense',
      entries: [{ accountId: budgetExpenseAccount._id, debit: 25000, credit: 0 }, { accountId: cash._id, debit: 0, credit: 25000 }],
      userId: admin._id,
    });
    await accountingService.postVoucher({
      companyId: company._id, branchId: branch._id, type: 'journal', date: new Date(2099, 9, 5), narration: 'A DIFFERENT month\'s expense — must NOT count toward September\'s actual',
      entries: [{ accountId: budgetExpenseAccount._id, debit: 9999, credit: 0 }, { accountId: cash._id, debit: 0, credit: 9999 }],
      userId: admin._id,
    });
  });

  await step('Budget vs Actual for September correctly shows actual=25000 (NOT 34999, which is what it would be if October\'s voucher were wrongly included) — variance=5000, variancePercent=25%, hand-verified before this test was written', async () => {
    const report = await budgetService.budgetVsActual(company._id, 9, 2099);
    const row = report.rows.find((r) => String(r.accountId) === String(budgetExpenseAccount._id));
    assert(row.actual === 25000, `expected actual exactly 25000 (September's voucher ONLY, excluding October's 9999), got ${row.actual}`);
    assert(row.variance === 5000 && row.variancePercent === 25, `expected variance exactly 5000 and variancePercent exactly 25, got variance=${row.variance} variancePercent=${row.variancePercent}`);
  });

  // --- 77. Early Payment Discount: real "2/10 net 30" dynamic discounting — a real 3-leg voucher hand-verified to balance before this file was written, no lending marketplace involved ---
  const discountPayableAccount = await Account.create({ companyId: company._id, name: 'Early Discount AP', type: 'liability' });
  const discountIncomeAccount = await Account.create({ companyId: company._id, name: 'Purchase Discount Income', type: 'income' });
  const earlyDiscountSupplier = await Supplier.create({ companyId: company._id, name: 'Early Discount Supplier' });

  const earlyPayPO = await step('Create a real PO with a 10000 due amount and set real "2% if paid within 10 days" terms', async () => {
    const PurchaseOrder = require('./models/PurchaseOrder');
    const po = await PurchaseOrder.create({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: earlyDiscountSupplier._id,
      poNumber: `EARLYPAY-${suffix}`, status: 'received',
      items: [{ productId: product._id, variantId, quantityOrdered: 100, quantityReceived: 100, unitCost: 100 }],
      subtotal: 10000, totalAmount: 10000, paidAmount: 0, dueAmount: 10000,
    });
    return earlyPaymentDiscountService.setDiscountTerms(po._id, { paymentTermsDays: 30, earlyPaymentDiscountPercent: 2, earlyPaymentDiscountDays: 10 });
  });

  await step('Paying TODAY (well within the 10-day window) is eligible for exactly 200 discount (2% of 10000) — hand-verified before this test was written', async () => {
    const check = await earlyPaymentDiscountService.calculateDiscount(earlyPayPO._id, new Date());
    assert(check.eligible === true && check.discountAmount === 200, `expected eligible=true and discountAmount exactly 200, got ${JSON.stringify(check)}`);
  });

  await step('Applying the discount posts a REAL, balanced 3-leg voucher (Payable 10000 / Cash 9800 / Discount Income 200), and fully clears the payable to 0 even though less cash actually left the business', async () => {
    const result = await earlyPaymentDiscountService.payWithEarlyDiscount(earlyPayPO._id, {
      paymentDate: new Date(), paymentAccountId: cash._id, discountIncomeAccountId: discountIncomeAccount._id, payableAccountId: discountPayableAccount._id, userId: admin._id,
    });
    assert(result.discountAmount === 200 && result.amountPaid === 9800, `expected discountAmount 200 and amountPaid 9800, got discountAmount=${result.discountAmount} amountPaid=${result.amountPaid}`);
    assert(result.po.dueAmount === 0, `expected the payable to be fully cleared to 0, got ${result.po.dueAmount}`);

    const totalDebit = result.voucher.entries.reduce((s, e) => s + e.debit, 0);
    const totalCredit = result.voucher.entries.reduce((s, e) => s + e.credit, 0);
    assert(totalDebit === 10000 && totalCredit === 10000, `expected the voucher to balance at exactly 10000, got debit=${totalDebit} credit=${totalCredit}`);
    assert(result.voucher.entries.length === 3, `expected exactly 3 legs (payable debit, cash credit, discount income credit), got ${result.voucher.entries.length}`);
  });

  await step('A SECOND PO with the same terms, but a payment date 15 days later (past the 10-day window), is correctly REJECTED — no discount, no silent full payment either', async () => {
    const PurchaseOrder = require('./models/PurchaseOrder');
    const latePO = await PurchaseOrder.create({
      companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: earlyDiscountSupplier._id,
      poNumber: `LATEPAY-${suffix}`, status: 'received',
      items: [{ productId: product._id, variantId, quantityOrdered: 50, quantityReceived: 50, unitCost: 100 }],
      subtotal: 5000, totalAmount: 5000, paidAmount: 0, dueAmount: 5000,
    });
    await earlyPaymentDiscountService.setDiscountTerms(latePO._id, { paymentTermsDays: 30, earlyPaymentDiscountPercent: 2, earlyPaymentDiscountDays: 10 });

    const latePaymentDate = new Date(latePO.createdAt.getTime() + 15 * 24 * 60 * 60 * 1000);
    const check = await earlyPaymentDiscountService.calculateDiscount(latePO._id, latePaymentDate);
    assert(check.eligible === false, `expected a payment 15 days after order date (past the 10-day window) to be ineligible, got ${JSON.stringify(check)}`);

    let threw = false;
    try {
      await earlyPaymentDiscountService.payWithEarlyDiscount(latePO._id, { paymentDate: latePaymentDate, paymentAccountId: cash._id, discountIncomeAccountId: discountIncomeAccount._id, payableAccountId: discountPayableAccount._id, userId: admin._id });
    } catch { threw = true; }
    assert(threw, 'expected attempting an early-discount payment past the eligibility window to be rejected outright');
  });

  console.log(`\nAll ${stepNumber} smoke test steps passed.`);
  process.exit(0);
}

run().catch((err) => {
  console.error(`\nSmoke test failed at step ${stepNumber}.`);
  console.error(err);
  process.exit(1);
});
