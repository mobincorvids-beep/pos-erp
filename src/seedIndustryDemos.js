/**
 * seedIndustryDemos.js — creates one demo tenant company PER INDUSTRY the
 * frontend supports (client/src/industryModuleRegistry.js), each with its
 * own admin login and 2-4 realistic sample records in that industry's
 * dedicated module, plus a couple of common core-ERP records (a purchase
 * order, an expense) so the demo doesn't look like an empty shell.
 *
 * Run with: node src/seedIndustryDemos.js  (requires MONGO_URI in .env)
 *
 * Safe to re-run: skips any industry whose demo admin email already exists.
 * Every login uses the SAME fixed password so it's easy to remember:
 *
 *     <industry-slug>@demo.test / password123
 *
 * All the specific service calls below are copied directly from the
 * patterns already proven working in src/smokeTest.js — see that file for
 * the full assertions/traces behind each number used here.
 */
require('dotenv').config();
const connectDB = require('./config/db');

const Account = require('./models/Account');
const Product = require('./models/Product');
const Customer = require('./models/Customer');
const Supplier = require('./models/Supplier');
const Company = require('./models/Company');
const User = require('./models/User');
const ExpenseCategory = require('./models/ExpenseCategory');

const companyProvisioningService = require('./services/companyProvisioningService');
const inventoryService = require('./services/inventoryService');
const posSaleService = require('./services/posSaleService');
const purchaseService = require('./services/purchaseService');
const expenseService = require('./services/expenseService');
const hrService = require('./services/hrService');
const manufacturingService = require('./services/manufacturingService');
const projectService = require('./services/projectService');

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
const pharmacyService = require('./modules/pharmacy/services/pharmacyService');
const Patient = require('./modules/pharmacy/models/Patient');
const Prescription = require('./modules/pharmacy/models/Prescription');
const RestaurantTable = require('./modules/restaurant/models/Table');
const KitchenOrderTicket = require('./modules/restaurant/models/KitchenOrderTicket');

const PASSWORD = 'password123';

// The exact 44-entry list the frontend actually has pages for — see
// client/src/industryModuleRegistry.js. Do not add industries not listed there.
const INDUSTRIES = [
  { key: 'restaurant', label: 'Restaurant' },
  { key: 'pharmacy', label: 'Pharmacy' },
  { key: 'salon', label: 'Salon' },
  { key: 'jewelry', label: 'Jewelry' },
  { key: 'hotel', label: 'Hotel' },
  { key: 'travel', label: 'Travel' },
  { key: 'insurance', label: 'Insurance' },
  { key: 'sports', label: 'Sports' },
  { key: 'media_entertainment', label: 'Events & Ticketing' },
  { key: 'telecom', label: 'Telecom' },
  { key: 'professional_services', label: 'Time & Billing' },
  { key: 'agriculture', label: 'Agriculture' },
  { key: 'import_export', label: 'Import/Export' },
  { key: 'pharmaceutical', label: 'Batch Recalls' },
  { key: 'construction', label: 'Construction' },
  { key: 'logistics', label: 'Logistics' },
  { key: 'automobile', label: 'Automobile' },
  { key: 'car_rental', label: 'Car Rental' },
  { key: 'courier', label: 'Courier' },
  { key: 'dairy', label: 'Dairy' },
  { key: 'petrol_pump', label: 'Petrol Pump' },
  { key: 'warehouse_3pl', label: '3PL Warehouse' },
  { key: 'hajj_umrah', label: 'Hajj/Umrah' },
  { key: 'housing_society', label: 'Housing Society' },
  { key: 'ngo', label: 'NGO' },
  { key: 'real_estate', label: 'Real Estate' },
  { key: 'school', label: 'School' },
  { key: 'distribution', label: 'Distribution' },
  { key: 'banquet', label: 'Banquet' },
  { key: 'service_station', label: 'Service Station' },
  { key: 'hospital', label: 'Hospital' },
  { key: 'gym', label: 'Gym' },
  { key: 'auto_parts', label: 'Auto Parts' },
  { key: 'electronics', label: 'Electronics' },
  { key: 'furniture', label: 'Furniture' },
  { key: 'fashion', label: 'Fashion' },
  { key: 'bakery', label: 'Bakery' },
  { key: 'grocery', label: 'Grocery' },
  { key: 'footwear', label: 'Footwear' },
  { key: 'textile', label: 'Textile' },
  { key: 'hardware', label: 'Hardware' },
  { key: 'retail', label: 'Retail' },
  { key: 'cafe', label: 'Cafe' },
  { key: 'toys_gifts', label: 'Toys & Gifts' },
];

function emailFor(key) {
  return `${key.replace(/_/g, '-')}@demo.test`;
}

async function seedCoreErp(ctx) {
  const { company, branch, warehouse, supplier, cash, accounts } = ctx;
  const salariesAcc = accounts.find((a) => /Salar/.test(a.name));
  const suffix = company._id.toString().slice(-6);

  const genericProduct = await Product.create({
    companyId: company._id, name: 'Office Supplies', sku: `OFC-${suffix}`,
    trackingMode: 'simple', costPrice: 100, sellingPrice: 150,
    variants: [{ sku: `OFC-${suffix}`, sellingPrice: 150 }],
  });

  const po = await purchaseService.createPurchaseOrder({
    companyId: company._id, branchId: branch._id, warehouseId: warehouse._id, supplierId: supplier._id,
    items: [{ productId: genericProduct._id, variantId: genericProduct.variants[0]._id, quantityOrdered: 10, unitCost: 100 }],
    userId: ctx.admin._id,
  });
  const approvedPo = await purchaseService.decidePurchaseOrder(po._id, { approve: true, userId: ctx.admin._id });
  await purchaseService.receiveGoods({
    purchaseOrderId: approvedPo._id, warehouseId: warehouse._id,
    items: [{ purchaseOrderItemId: approvedPo.items[0]._id, productId: genericProduct._id, variantId: genericProduct.variants[0]._id, quantity: 10, unitCost: 100 }],
    userId: ctx.admin._id,
  });

  const category = await ExpenseCategory.create({ companyId: company._id, name: 'Office Expenses', accountId: salariesAcc._id });
  const expense = await expenseService.submitExpense({
    companyId: company._id, categoryId: category._id, paymentAccountId: cash._id, amount: 500, userId: ctx.admin._id,
  });
  await expenseService.approveExpense(expense._id, null);

  // one employee + one project so HR and Projects screens show real data too
  await hrService.createEmployee({
    companyId: company._id, branchId: branch._id, name: 'Demo Employee',
    salaryStructure: { basic: 40000, allowances: 2000, deductions: 0 },
  });
  await projectService.createProject({ companyId: company._id, name: 'Demo Project', budget: 50000, customerId: ctx.customer._id });
}

async function simpleProduct(companyId, name, sku, costPrice, sellingPrice, trackingMode = 'simple') {
  return Product.create({
    companyId, name, sku, trackingMode, costPrice, sellingPrice,
    variants: [{ sku, sellingPrice }],
  });
}

async function serviceProduct(companyId, name, sku) {
  return Product.create({
    companyId, name, sku, trackingMode: 'service', costPrice: 0, sellingPrice: 0,
    variants: [{ sku, sellingPrice: 0 }],
  });
}

async function stockedProduct(ctx, name, sku, costPrice, sellingPrice, qty) {
  const p = await simpleProduct(ctx.company._id, name, sku, costPrice, sellingPrice);
  await inventoryService.recordMovement({
    companyId: ctx.company._id, warehouseId: ctx.warehouse._id, productId: p._id, variantId: p.variants[0]._id,
    type: 'adjustment', quantity: qty, note: 'Demo seed opening stock',
  });
  return p;
}

// ---------------------------------------------------------------------
// Per-industry module seeders. Each receives { company, branch, warehouse,
// admin, cash, customer, supplier, accounts, suffix } and creates 2-4
// records that exercise that industry's dedicated module.
// ---------------------------------------------------------------------
const industrySeeders = {

  restaurant: async (ctx) => {
    const t1 = await RestaurantTable.create({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Table 1', seats: 4, status: 'occupied' });
    await RestaurantTable.create({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Table 2', seats: 2, status: 'free' });
    await RestaurantTable.create({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Patio 1', seats: 6, status: 'reserved' });
    const burger = await stockedProduct(ctx, 'Beef Burger', `BURG-${ctx.suffix}`, 250, 550, 40);
    await KitchenOrderTicket.create({
      companyId: ctx.company._id, branchId: ctx.branch._id, tableId: t1._id,
      items: [{ productId: burger._id, variantId: burger.variants[0]._id, quantity: 2, modifiers: ['No onions'], status: 'preparing' }],
      status: 'sent_to_kitchen',
    });
  },

  pharmacy: async (ctx) => {
    const amoxicillin = await stockedProduct(ctx, 'Amoxicillin 500mg', `AMOX-${ctx.suffix}`, 20, 40, 200);
    const paracetamol = await stockedProduct(ctx, 'Paracetamol 500mg', `PARA-${ctx.suffix}`, 5, 12, 300);
    const patient = await Patient.create({ companyId: ctx.company._id, customerId: ctx.customer._id, name: 'Demo Patient', age: 34, gender: 'male', phone: '+15551234567' });
    const prescription = await Prescription.create({
      companyId: ctx.company._id, patientId: patient._id,
      items: [
        { productId: amoxicillin._id, variantId: amoxicillin.variants[0]._id, medicineName: 'Amoxicillin 500mg', dosage: '500mg', frequency: 'twice daily', durationDays: 7, quantityPrescribed: 14 },
        { productId: paracetamol._id, variantId: paracetamol.variants[0]._id, medicineName: 'Paracetamol 500mg', dosage: '500mg', frequency: 'as needed', durationDays: 5, quantityPrescribed: 10 },
      ],
      status: 'pending',
    });
    await pharmacyService.dispensePrescription({
      prescriptionId: prescription._id,
      saleInput: {
        userId: ctx.admin._id, companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id,
        items: [
          { productId: amoxicillin._id, variantId: amoxicillin.variants[0]._id, quantity: 14, unitPrice: 40 },
          { productId: paracetamol._id, variantId: paracetamol.variants[0]._id, quantity: 10, unitPrice: 12 },
        ],
        payments: [{ paymentAccountId: ctx.cash._id, method: 'cash', amount: 14 * 40 + 10 * 12 }],
      },
    });
  },

  salon: async (ctx) => {
    const stylist = await hrService.createEmployee({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Demo Stylist', salaryStructure: { basic: 25000, allowances: 0, deductions: 0 } });
    const haircut = await serviceProduct(ctx.company._id, 'Haircut', `HC-${ctx.suffix}`);
    const svc = await salonService.createService({ companyId: ctx.company._id, productId: haircut._id, variantId: haircut.variants[0]._id, name: 'Haircut', price: 1500, commissionType: 'percentage', commissionRate: 20 });
    await salonService.billServiceWithCommission({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, salonServiceId: svc._id, employeeId: stylist._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    const pkgProduct = await serviceProduct(ctx.company._id, '5-Haircut Package', `PKG-${ctx.suffix}`);
    const pkg = await salonService.createMembershipPackage({ companyId: ctx.company._id, productId: pkgProduct._id, variantId: pkgProduct.variants[0]._id, name: '5-Haircut Package', salonServiceId: svc._id, totalSessions: 5, price: 6000, validityDays: 180 });
    await salonService.sellMembership({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, membershipPackageId: pkg._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
  },

  jewelry: async (ctx) => {
    const ring = await Product.create({ companyId: ctx.company._id, name: '22k Gold Ring', sku: `RING-${ctx.suffix}`, trackingMode: 'weight', isWeightBased: true, costPrice: 0, sellingPrice: 0, variants: [{ sku: `RING-${ctx.suffix}`, weight: 5.5 }] });
    await jewelryPricingService.setGoldRate(ctx.company._id, 22, 20000);
    await jewelryPricingService.configureItem({ companyId: ctx.company._id, productId: ring._id, variantId: ring.variants[0]._id, karat: 22, makingChargeType: 'percentage', makingChargeValue: 10, stoneCharge: 500 });
    const quote = await jewelryPricingService.quotePrice(ctx.company._id, ring.variants[0]._id);
    await inventoryService.recordMovement({ companyId: ctx.company._id, warehouseId: ctx.warehouse._id, productId: ring._id, variantId: ring.variants[0]._id, type: 'adjustment', quantity: 3, note: 'Demo seed opening stock' });
    await posSaleService.checkout({ userId: ctx.admin._id, companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, items: [{ productId: ring._id, variantId: ring.variants[0]._id, quantity: 1, unitPrice: quote.totalPrice }], payments: [{ paymentAccountId: ctx.cash._id, method: 'cash', amount: quote.totalPrice }] });
    await buybackService.intake({ companyId: ctx.company._id, customerId: ctx.customer._id, karat: 22, weightGrams: 10, deductionPercent: 5, userId: ctx.admin._id });
  },

  hotel: async (ctx) => {
    const roomBilling = await serviceProduct(ctx.company._id, 'Room Charge', `ROOM-${ctx.suffix}`);
    const room1 = await hotelService.createRoom({ companyId: ctx.company._id, branchId: ctx.branch._id, roomNumber: '101', roomType: 'Deluxe', ratePerNight: 8000, billingProductId: roomBilling._id, billingVariantId: roomBilling.variants[0]._id });
    await hotelService.createRoom({ companyId: ctx.company._id, branchId: ctx.branch._id, roomNumber: '102', roomType: 'Standard', ratePerNight: 5000, billingProductId: roomBilling._id, billingVariantId: roomBilling.variants[0]._id });
    const depositAcc = await Account.create({ companyId: ctx.company._id, name: 'Guest Deposits', type: 'liability' });
    const checkIn = new Date();
    const checkOut = new Date(checkIn.getTime() + 3 * 24 * 60 * 60 * 1000);
    await hotelService.bookReservation({ companyId: ctx.company._id, branchId: ctx.branch._id, roomId: room1._id, customerId: ctx.customer._id, checkInDate: checkIn, checkOutDate: checkOut, advanceAmount: 10000, advanceReceivedInAccountId: ctx.cash._id, depositLiabilityAccountId: depositAcc._id, userId: ctx.admin._id });
  },

  travel: async (ctx) => {
    const liability = await Account.create({ companyId: ctx.company._id, name: 'Travel Deposits', type: 'liability' });
    const billing = await serviceProduct(ctx.company._id, 'Tour Package', `TOUR-${ctx.suffix}`);
    const booking = await travelService.bookPackage({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, packageName: 'Istanbul Tour', travelDate: new Date(Date.now() + 30 * 86400000), price: 100000, depositAmount: 20000, depositReceivedInAccountId: ctx.cash._id, depositLiabilityAccountId: liability._id, billingProductId: billing._id, billingVariantId: billing.variants[0]._id, userId: ctx.admin._id });
    await travelService.finalizeBooking(booking._id, { warehouseId: ctx.warehouse._id, finalPaymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    await travelService.bookPackage({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, packageName: 'Dubai Getaway', travelDate: new Date(Date.now() + 45 * 86400000), price: 50000, depositAmount: 10000, depositReceivedInAccountId: ctx.cash._id, depositLiabilityAccountId: liability._id, billingProductId: billing._id, billingVariantId: billing.variants[0]._id, userId: ctx.admin._id });
  },

  insurance: async (ctx) => {
    const billing = await serviceProduct(ctx.company._id, 'Motor Insurance Premium', `INS-${ctx.suffix}`);
    const claimsExpense = await Account.create({ companyId: ctx.company._id, name: 'Insurance Claims Expense', type: 'expense' });
    const policy = await insuranceService.sellPolicy({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, policyType: 'Motor', coverageAmount: 500000, premiumAmount: 20000, startDate: new Date(), endDate: new Date(Date.now() + 365 * 86400000), billingProductId: billing._id, billingVariantId: billing.variants[0]._id, warehouseId: ctx.warehouse._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    const claim = await insuranceService.submitClaim(policy._id, { claimAmount: 100000, description: 'Windshield damage' });
    await insuranceService.decideClaim(claim._id, { approve: true, decisionNote: 'Approved after inspection', payoutAccountId: ctx.cash._id, claimsExpenseAccountId: claimsExpense._id, userId: ctx.admin._id });
  },

  sports: async (ctx) => {
    const billing = await serviceProduct(ctx.company._id, 'Court Time', `COURT-${ctx.suffix}`);
    const facility = await sportsService.createFacility({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Court 1', hourlyRate: 1000 });
    const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sportsService.bookSlot(facility._id, { customerId: ctx.customer._id, startTime: start, endTime: new Date(start.getTime() + 2 * 3600000), billingProductId: billing._id, billingVariantId: billing.variants[0]._id, warehouseId: ctx.warehouse._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    await sportsService.createFacility({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Court 2', hourlyRate: 1200 });
  },

  media_entertainment: async (ctx) => {
    const billing = await serviceProduct(ctx.company._id, 'Event Ticket', `TICKET-${ctx.suffix}`);
    const show = await eventTicketingService.createShow({ companyId: ctx.company._id, branchId: ctx.branch._id, eventName: 'Live Concert', showDateTime: new Date(Date.now() + 14 * 86400000), tiers: [{ name: 'VIP', capacity: 20, price: 20000 }, { name: 'Standard', capacity: 100, price: 5000 }] });
    await eventTicketingService.bookTicket(show._id, show.tiers[0]._id, { customerId: ctx.customer._id, warehouseId: ctx.warehouse._id, ticketBillingProductId: billing._id, ticketBillingVariantId: billing.variants[0]._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    await eventTicketingService.bookTicket(show._id, show.tiers[1]._id, { customerId: ctx.customer._id, warehouseId: ctx.warehouse._id, ticketBillingProductId: billing._id, ticketBillingVariantId: billing.variants[0]._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
  },

  telecom: async (ctx) => {
    const billing = await serviceProduct(ctx.company._id, 'Plan Fee', `PLAN-${ctx.suffix}`);
    const overage = await serviceProduct(ctx.company._id, 'Usage Overage', `OVERAGE-${ctx.suffix}`);
    const plan = await telecomService.createPlan({ companyId: ctx.company._id, name: 'Postpaid 500', monthlyFee: 1000, includedMinutes: 500, includedDataMB: 1000, includedSms: 100, overageRatePerMinute: 2, overageRatePerMB: 0.5, overageRatePerSms: 1, billingProductId: billing._id, billingVariantId: billing.variants[0]._id, overageBillingProductId: overage._id, overageBillingVariantId: overage.variants[0]._id });
    const sub = await telecomService.subscribeCustomer({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, planId: plan._id, warehouseId: ctx.warehouse._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    await telecomService.recordUsage(sub._id, { minutes: 550, dataMB: 1200, sms: 80 });
    await telecomService.generateMonthlyBill(sub._id, { warehouseId: ctx.warehouse._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
  },

  professional_services: async (ctx) => {
    const billing = await serviceProduct(ctx.company._id, 'Consulting Services', `CONSULT-${ctx.suffix}`);
    const consultant = await hrService.createEmployee({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Senior Consultant', designation: 'Consultant', salaryStructure: { basic: 150000, allowances: 0, deductions: 0 } });
    await timeEntryService.logTime({ companyId: ctx.company._id, branchId: ctx.branch._id, employeeId: consultant._id, clientCustomerId: ctx.customer._id, description: 'Strategy session', hours: 3, hourlyRate: 5000 });
    await timeEntryService.logTime({ companyId: ctx.company._id, branchId: ctx.branch._id, employeeId: consultant._id, clientCustomerId: ctx.customer._id, description: 'Client call', hours: 2, hourlyRate: 5000 });
    await timeEntryService.generateInvoice(ctx.company._id, ctx.customer._id, { warehouseId: ctx.warehouse._id, billingProductId: billing._id, billingVariantId: billing.variants[0]._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
  },

  agriculture: async (ctx) => {
    const seeds = await stockedProduct(ctx, 'Wheat Seeds', `SEEDS-${ctx.suffix}`, 5, 5, 5000);
    const harvest = await simpleProduct(ctx.company._id, 'Wheat Harvest', `WHEAT-${ctx.suffix}`, 0, 50);
    const bom = await manufacturingService.createBOM({ companyId: ctx.company._id, finishedProductId: harvest._id, finishedVariantId: harvest.variants[0]._id, name: 'Wheat BOM', components: [{ productId: seeds._id, variantId: seeds.variants[0]._id, quantityPerUnit: 2 }], laborCostPerUnit: 10, overheadCostPerUnit: 5 });
    const field = await agricultureService.createFarmField({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'North Field', areaAcres: 10 });
    const cycle = await agricultureService.startCropCycle({ companyId: ctx.company._id, branchId: ctx.branch._id, fieldId: field._id, bomId: bom._id, warehouseId: ctx.warehouse._id, cropName: 'Wheat', plantedDate: new Date(), expectedYield: 100, userId: ctx.admin._id });
    await agricultureService.completeHarvest(cycle._id, { actualYield: 110, actualLaborCost: 1100, actualOverheadCost: 550, userId: ctx.admin._id });
  },

  import_export: async (ctx) => {
    const [a, b] = await Promise.all([
      simpleProduct(ctx.company._id, 'Import Item A', `IMPA-${ctx.suffix}`, 0, 200),
      simpleProduct(ctx.company._id, 'Import Item B', `IMPB-${ctx.suffix}`, 0, 400),
    ]);
    const inventoryAsset = await Account.create({ companyId: ctx.company._id, name: 'Import Inventory Asset', type: 'asset' });
    const supplierPayable = await Account.create({ companyId: ctx.company._id, name: 'Import Supplier Payable', type: 'liability' });
    const customs = await Account.create({ companyId: ctx.company._id, name: 'Customs Duty Payable', type: 'liability' });
    const shipment = await importShipmentService.createShipment({ companyId: ctx.company._id, branchId: ctx.branch._id, supplierId: ctx.supplier._id, items: [{ productId: a._id, variantId: a.variants[0]._id, quantity: 10, unitPrice: 100 }, { productId: b._id, variantId: b.variants[0]._id, quantity: 5, unitPrice: 200 }], additionalCosts: [{ type: 'customs_duty', amount: 100, accountId: customs._id }] });
    await importShipmentService.receiveShipment(shipment._id, { warehouseId: ctx.warehouse._id, inventoryAssetAccountId: inventoryAsset._id, supplierPayableAccountId: supplierPayable._id, userId: ctx.admin._id });
  },

  pharmaceutical: async (ctx) => {
    const ProductBatch = require('./models/ProductBatch');
    const drug = await simpleProduct(ctx.company._id, 'Amoxicillin 500mg', `AMOXR-${ctx.suffix}`, 20, 40, 'batch');
    const batch = await ProductBatch.create({ companyId: ctx.company._id, productId: drug._id, variantId: drug.variants[0]._id, batchNumber: `LOT-${ctx.suffix}`, manufactureDate: new Date(), expiryDate: new Date(Date.now() + 365 * 86400000) });
    await inventoryService.recordMovement({ companyId: ctx.company._id, warehouseId: ctx.warehouse._id, productId: drug._id, variantId: drug.variants[0]._id, batchId: batch._id, type: 'adjustment', quantity: 100, note: 'Demo seed opening stock' });
    await posSaleService.checkout({ userId: ctx.admin._id, companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, items: [{ productId: drug._id, variantId: drug.variants[0]._id, batchId: batch._id, quantity: 5, unitPrice: 40 }], payments: [{ paymentAccountId: ctx.cash._id, method: 'cash', amount: 200 }] });
    await batchRecallService.initiateRecall({ companyId: ctx.company._id, batchId: batch._id, productId: drug._id, reason: 'Contamination found in lab testing', userId: ctx.admin._id });
  },

  construction: async (ctx) => {
    const project = await projectService.createProject({ companyId: ctx.company._id, name: 'Site Renovation', budget: 20000, customerId: ctx.customer._id });
    const boq = await billOfQuantitiesService.createBOQ({ companyId: ctx.company._id, projectId: project._id, title: 'Renovation BOQ', lineItems: [{ description: 'Cement bags', unit: 'bag', estimatedQuantity: 100, estimatedRate: 50, costType: 'material' }, { description: 'Steel rods', unit: 'rod', estimatedQuantity: 50, estimatedRate: 200, costType: 'material' }, { description: 'Masons', unit: 'day', estimatedQuantity: 30, estimatedRate: 100, costType: 'labor' }] });
    const ProjectCost = require('./models/ProjectCost');
    await ProjectCost.create({ companyId: ctx.company._id, projectId: project._id, type: 'material', amount: 12000, note: 'Actual cement + steel spend' });
    await ProjectCost.create({ companyId: ctx.company._id, projectId: project._id, type: 'labor', amount: 3500, note: 'Actual mason wages' });
    await billOfQuantitiesService.varianceReport(boq._id);
  },

  logistics: async (ctx) => {
    const van = await logisticsService.createVehicle({ companyId: ctx.company._id, branchId: ctx.branch._id, registrationNumber: `VAN-${ctx.suffix}`, vehicleType: 'Van' });
    const driver = await logisticsService.createDriver({ companyId: ctx.company._id, name: 'Demo Driver' });
    const trip = await logisticsService.startTrip({ companyId: ctx.company._id, branchId: ctx.branch._id, vehicleId: van._id, driverId: driver._id, routeDescription: 'North Zone Deliveries', startOdometer: 1000 });
    await logisticsService.addDeliveryToTrip(trip._id, { referenceType: 'Sale', referenceId: ctx.customer._id, revenue: 2000 });
    await logisticsService.addDeliveryToTrip(trip._id, { referenceType: 'Sale', referenceId: ctx.customer._id, revenue: 2500 });
    await logisticsService.completeTrip(trip._id, { endOdometer: 1150, fuelCost: 3000, otherCosts: 500 });
  },

  automobile: async (ctx) => {
    const car = await Product.create({ companyId: ctx.company._id, name: 'Sedan', sku: `SEDAN-${ctx.suffix}`, trackingMode: 'serial', costPrice: 2000000, sellingPrice: 2500000, variants: [{ sku: `SEDAN-${ctx.suffix}`, sellingPrice: 2500000 }] });
    const po = await purchaseService.createPurchaseOrder({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, supplierId: ctx.supplier._id, items: [{ productId: car._id, variantId: car.variants[0]._id, quantityOrdered: 1, unitCost: 2000000 }], userId: ctx.admin._id });
    const approved = await purchaseService.decidePurchaseOrder(po._id, { approve: true, userId: ctx.admin._id });
    await purchaseService.receiveGoods({ purchaseOrderId: approved._id, warehouseId: ctx.warehouse._id, items: [{ purchaseOrderItemId: approved.items[0]._id, productId: car._id, variantId: car.variants[0]._id, quantity: 1, unitCost: 2000000, serialNumbers: [`VIN-${ctx.suffix}`] }], userId: ctx.admin._id });
    await tradeInService.intake({ companyId: ctx.company._id, customerId: ctx.customer._id, vehicleDescription: 'Old Corolla', appraisedValue: 300000, userId: ctx.admin._id });
  },

  car_rental: async (ctx) => {
    const [vehicleA, vehicleB] = await Promise.all([
      carRentalService.addVehicle({ companyId: ctx.company._id, branchId: ctx.branch._id, vehicleClass: 'Compact', registrationNumber: `CAR-A-${ctx.suffix}`, dailyRate: 3000 }),
      carRentalService.addVehicle({ companyId: ctx.company._id, branchId: ctx.branch._id, vehicleClass: 'Compact', registrationNumber: `CAR-B-${ctx.suffix}`, dailyRate: 3000 }),
    ]);
    const usage = await serviceProduct(ctx.company._id, 'Car Rental Usage', `CARUSE-${ctx.suffix}`);
    const start = new Date(Date.now() + 5 * 86400000);
    const end = new Date(Date.now() + 8 * 86400000);
    await carRentalService.bookRental({ companyId: ctx.company._id, branchId: ctx.branch._id, vehicleClass: 'Compact', customerId: ctx.customer._id, startDate: start, endDate: end, rentalBillingProductId: usage._id, rentalBillingVariantId: usage.variants[0]._id, userId: ctx.admin._id });
    void vehicleA; void vehicleB;
  },

  courier: async (ctx) => {
    const shipment = await shipmentService.createShipment({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, trackingNumber: `TRK-${ctx.suffix}`, origin: 'Karachi', destination: 'Lahore' });
    await shipmentService.advanceStatus(shipment._id, { status: 'picked_up', location: 'Karachi' });
    await shipmentService.advanceStatus(shipment._id, { status: 'in_transit', location: 'En route' });
    await shipmentService.advanceStatus(shipment._id, { status: 'out_for_delivery', location: 'Lahore' });
    const shippingFee = await serviceProduct(ctx.company._id, 'Shipping Fee', `SHIP-${ctx.suffix}`);
    await shipmentService.markDelivered(shipment._id, { proofOfDeliveryNote: 'Signed by receptionist', shippingFeeProductId: shippingFee._id, shippingFeeVariantId: shippingFee.variants[0]._id, shippingFee: 500, warehouseId: ctx.warehouse._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    await shipmentService.createShipment({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, trackingNumber: `TRK2-${ctx.suffix}`, origin: 'Lahore', destination: 'Islamabad' });
  },

  dairy: async (ctx) => {
    const schedule = await dairyCollectionService.createSchedule({ companyId: ctx.company._id, name: 'Standard Milk Grades', bands: [{ minFatPercent: 3.0, pricePerLitre: 100 }, { minFatPercent: 4.0, pricePerLitre: 120 }, { minFatPercent: 5.0, pricePerLitre: 140 }] });
    const expenseAcc = await Account.create({ companyId: ctx.company._id, name: 'Milk Purchase Expense', type: 'expense' });
    const payableAcc = await Account.create({ companyId: ctx.company._id, name: 'Accounts Payable - Farmers', type: 'liability' });
    await dairyCollectionService.recordCollection({ companyId: ctx.company._id, branchId: ctx.branch._id, supplierId: ctx.supplier._id, litres: 50, fatPercent: 4.0, scheduleId: schedule._id, expenseAccountId: expenseAcc._id, payableAccountId: payableAcc._id, userId: ctx.admin._id });
    await dairyCollectionService.recordCollection({ companyId: ctx.company._id, branchId: ctx.branch._id, supplierId: ctx.supplier._id, litres: 30, fatPercent: 5.2, scheduleId: schedule._id, expenseAccountId: expenseAcc._id, payableAccountId: payableAcc._id, userId: ctx.admin._id });
  },

  petrol_pump: async (ctx) => {
    const fuel = await serviceProduct(ctx.company._id, 'Petrol', `FUEL-${ctx.suffix}`);
    const dispenser = await fuelShiftService.createDispenser({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Pump 1', productId: fuel._id, variantId: fuel.variants[0]._id, currentMeterReading: 1000 });
    await fuelShiftService.openShift(dispenser._id, { pricePerLitre: 250, userId: ctx.admin._id });
    const [openShift] = await fuelShiftService.listShifts(ctx.company._id, { status: 'open' });
    await fuelShiftService.closeShift(openShift._id, { closingReading: 1150, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, paymentAccountId: ctx.cash._id, billingProductId: fuel._id, billingVariantId: fuel.variants[0]._id, userId: ctx.admin._id });
  },

  warehouse_3pl: async (ctx) => {
    const storable = await simpleProduct(ctx.company._id, 'Stored Widget', `STOREDGT-${ctx.suffix}`, 50, 100);
    const billing = await serviceProduct(ctx.company._id, 'Storage Fee', `STORE-${ctx.suffix}`);
    const periodStart = new Date();
    const periodEnd = new Date(periodStart.getTime() + 10 * 86400000);
    const contract = await storageContractService.createContract({ companyId: ctx.company._id, branchId: ctx.branch._id, clientCustomerId: ctx.customer._id, productId: storable._id, variantId: storable.variants[0]._id, ratePerUnitPerDay: 2, billingProductId: billing._id, billingVariantId: billing.variants[0]._id });
    await storageContractService.receiveGoods(contract._id, { quantity: 100, at: periodStart });
    await storageContractService.releaseGoods(contract._id, { quantity: 40, at: new Date(periodStart.getTime() + 5 * 86400000) });
    await storageContractService.billPeriod(contract._id, { periodStart, periodEnd, warehouseId: ctx.warehouse._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
  },

  hajj_umrah: async (ctx) => {
    const liability = await Account.create({ companyId: ctx.company._id, name: 'Pilgrimage Deposits', type: 'liability' });
    const billing = await serviceProduct(ctx.company._id, 'Umrah Package', `UMRAH-${ctx.suffix}`);
    const [pilgrimA, pilgrimB] = await Promise.all([
      Customer.create({ companyId: ctx.company._id, name: 'Pilgrim A' }),
      Customer.create({ companyId: ctx.company._id, name: 'Pilgrim B' }),
    ]);
    const group = await pilgrimageService.createGroup({ companyId: ctx.company._id, branchId: ctx.branch._id, packageName: 'Umrah - Demo Group', departureDate: new Date(Date.now() + 60 * 86400000), capacity: 20, packagePrice: 300000 });
    await pilgrimageService.enroll(group._id, { customerId: pilgrimA._id, depositLiabilityAccountId: liability._id });
    await pilgrimageService.enroll(group._id, { customerId: pilgrimB._id, depositLiabilityAccountId: liability._id });
    const paymentsA = await pilgrimageService.listPayments(ctx.company._id, { groupId: group._id, customerId: pilgrimA._id });
    await pilgrimageService.makePayment(paymentsA[0]._id, { amount: 50000, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    void billing;
  },

  housing_society: async (ctx) => {
    const billing = await serviceProduct(ctx.company._id, 'Society Maintenance Fee', `MAINT-${ctx.suffix}`);
    const [houseA, houseB] = await Promise.all([
      leaseService.createProperty({ companyId: ctx.company._id, branchId: ctx.branch._id, unitNumber: 'House 101', propertyType: 'house' }),
      leaseService.createProperty({ companyId: ctx.company._id, branchId: ctx.branch._id, unitNumber: 'House 102', propertyType: 'house' }),
    ]);
    const [residentA, residentB] = await Promise.all([
      Customer.create({ companyId: ctx.company._id, name: 'Resident A' }),
      Customer.create({ companyId: ctx.company._id, name: 'Resident B' }),
    ]);
    await societyService.enrollMember({ companyId: ctx.company._id, propertyId: houseA._id, residentCustomerId: residentA._id });
    await societyService.enrollMember({ companyId: ctx.company._id, propertyId: houseB._id, residentCustomerId: residentB._id });
    const charge = await societyService.createCharge({ companyId: ctx.company._id, name: 'Monthly Maintenance', amount: 5000, billingProductId: billing._id, billingVariantId: billing.variants[0]._id });
    await societyService.generateSocietyInvoices({ companyId: ctx.company._id, chargeId: charge._id, period: '2026-08', dueDate: new Date('2026-08-05') });
    await societyService.submitComplaint({ companyId: ctx.company._id, propertyId: houseA._id, residentCustomerId: residentA._id, category: 'plumbing', description: 'Leaking pipe in the kitchen', priority: 'high' });
  },

  ngo: async (ctx) => {
    const donationRevenue = await Account.create({ companyId: ctx.company._id, name: 'Donation Revenue', type: 'income' });
    const programExpense = await Account.create({ companyId: ctx.company._id, name: 'Program Expense', type: 'expense' });
    const donor = await Customer.create({ companyId: ctx.company._id, name: 'Anonymous Donor' });
    const fund = await fundService.createFund({ companyId: ctx.company._id, name: 'Education Fund', type: 'restricted', purposeDescription: 'School supplies only' });
    await fundService.recordDonation(fund._id, { donorCustomerId: donor._id, amount: 50000, branchId: ctx.branch._id, receivingAccountId: ctx.cash._id, donationRevenueAccountId: donationRevenue._id, userId: ctx.admin._id });
    await fundService.recordDisbursement(fund._id, { amount: 30000, description: 'School supplies purchase', branchId: ctx.branch._id, expenseAccountId: programExpense._id, payingAccountId: ctx.cash._id, userId: ctx.admin._id });
  },

  real_estate: async (ctx) => {
    const billing = await serviceProduct(ctx.company._id, 'Monthly Rent', `RENT-${ctx.suffix}`);
    const depositLiability = await Account.create({ companyId: ctx.company._id, name: 'Tenant Security Deposits', type: 'liability' });
    const apartment = await leaseService.createProperty({ companyId: ctx.company._id, branchId: ctx.branch._id, unitNumber: 'Apartment 3B', propertyType: 'apartment' });
    const leaseStart = new Date();
    const lease = await leaseService.startLease({ companyId: ctx.company._id, branchId: ctx.branch._id, propertyId: apartment._id, tenantCustomerId: ctx.customer._id, startDate: leaseStart, endDate: new Date(leaseStart.getTime() + 365 * 86400000), monthlyRent: 20000, lateFeePerDay: 100, securityDeposit: 40000, depositReceivedAccountId: ctx.cash._id, securityDepositLiabilityAccountId: depositLiability._id, userId: ctx.admin._id });
    await leaseService.createProperty({ companyId: ctx.company._id, branchId: ctx.branch._id, unitNumber: 'Apartment 4A', propertyType: 'apartment' });
    void lease; void billing;
  },

  school: async (ctx) => {
    const tuition = await serviceProduct(ctx.company._id, 'Monthly Tuition', `TUI-${ctx.suffix}`);
    const [studentA, studentB] = await Promise.all([
      schoolService.createStudent({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Student A', className: 'Grade 5' }),
      schoolService.createStudent({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Student B', className: 'Grade 5' }),
    ]);
    const feeStructure = await schoolService.createFeeStructure({ companyId: ctx.company._id, name: 'Grade 5 Tuition', className: 'Grade 5', amount: 5000, billingProductId: tuition._id, billingVariantId: tuition.variants[0]._id, frequency: 'monthly' });
    await schoolService.generateFeeInvoices({ companyId: ctx.company._id, feeStructureId: feeStructure._id, period: '2026-08', dueDate: new Date('2026-08-10') });
    await schoolService.markAttendance({ companyId: ctx.company._id, studentId: studentA._id, date: new Date(), status: 'present' });
    void studentB;
  },

  distribution: async (ctx) => {
    const wholesale = await stockedProduct(ctx, 'Bulk Widget', `BULK-${ctx.suffix}`, 20, 50, 1000);
    await distributionPricingService.setSchedule({ companyId: ctx.company._id, productId: wholesale._id, variantId: wholesale.variants[0]._id, minimumOrderQuantity: 10, tiers: [{ minQuantity: 10, unitPrice: 45 }, { minQuantity: 50, unitPrice: 40 }, { minQuantity: 100, unitPrice: 35 }] });
    await distributionPricingService.quoteAndCreateSalesOrder({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, userId: ctx.admin._id, items: [{ productId: wholesale._id, variantId: wholesale.variants[0]._id, quantity: 100 }] });
  },

  banquet: async (ctx) => {
    const catering = await serviceProduct(ctx.company._id, 'Catering (per person)', `CATER-${ctx.suffix}`);
    const venueRental = await serviceProduct(ctx.company._id, 'Venue Rental', `VENUE-${ctx.suffix}`);
    const venue = await bookingService.createVenue({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Grand Hall', capacity: 300, baseRentalFee: 15000, rentalBillingProductId: venueRental._id, rentalBillingVariantId: venueRental.variants[0]._id });
    const pkg = await bookingService.createPackage({ companyId: ctx.company._id, name: 'Silver Package', pricePerPerson: 2000, minGuests: 50, billingProductId: catering._id, billingVariantId: catering.variants[0]._id });
    const depositLiability = await Account.create({ companyId: ctx.company._id, name: 'Event Deposits', type: 'liability' });
    await bookingService.bookEvent({ companyId: ctx.company._id, branchId: ctx.branch._id, venueId: venue._id, packageId: pkg._id, customerId: ctx.customer._id, eventDate: new Date(Date.now() + 30 * 86400000), guestCount: 100, depositAmount: 50000, depositReceivedInAccountId: ctx.cash._id, depositLiabilityAccountId: depositLiability._id, userId: ctx.admin._id });
  },

  service_station: async (ctx) => {
    const vehicle = await vehicleService.registerVehicle({ companyId: ctx.company._id, customerId: ctx.customer._id, make: 'Toyota', model: 'Corolla', year: 2020, registrationNumber: `DEMO-${ctx.suffix}`, currentMileage: 10000, serviceIntervalMileage: 5000, serviceIntervalMonths: 6 });
    await vehicleService.recordServiceCompleted(vehicle._id, { mileageAtService: 10000, serviceDate: new Date() });
    await vehicleService.updateMileage(vehicle._id, 15000);
    await vehicleService.openJobCard({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, vehicleId: vehicle._id, itemDescription: 'Oil change', userId: ctx.admin._id });
  },

  hospital: async (ctx) => {
    const consult = await serviceProduct(ctx.company._id, 'Consultation', `CONSULT2-${ctx.suffix}`);
    await hospitalService.checkIn({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, chiefComplaint: 'Fever', consultationFee: 2000, billingProductId: consult._id, billingVariantId: consult.variants[0]._id });
    const c2 = await Customer.create({ companyId: ctx.company._id, name: 'Second Patient' });
    await hospitalService.checkIn({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: c2._id, chiefComplaint: 'Headache', consultationFee: 2000, billingProductId: consult._id, billingVariantId: consult.variants[0]._id });
    await hospitalService.callNext(ctx.branch._id, null);
  },

  gym: async (ctx) => {
    const gymClass = await gymService.createClass({ companyId: ctx.company._id, branchId: ctx.branch._id, name: 'Morning Yoga', capacity: 15 });
    const session = await gymService.scheduleSession(gymClass._id, new Date(Date.now() + 86400000));
    const memberA = await Customer.create({ companyId: ctx.company._id, name: 'Member A' });
    await gymService.enroll(session._id, memberA._id);
    await gymService.enroll(session._id, ctx.customer._id);
  },

  auto_parts: async (ctx) => {
    const brake = await simpleProduct(ctx.company._id, 'Front Brake Pads', `BRK-${ctx.suffix}`, 800, 1500);
    await fitmentService.addFitment({ companyId: ctx.company._id, productId: brake._id, make: 'Toyota', model: 'Corolla', yearFrom: 2015, yearTo: 2020 });
    const filter = await simpleProduct(ctx.company._id, 'Oil Filter', `OILF-${ctx.suffix}`, 300, 600);
    await fitmentService.addFitment({ companyId: ctx.company._id, productId: filter._id, make: 'Honda', model: 'Civic', yearFrom: 2016, yearTo: 2022 });
    await fitmentService.findPartsForVehicle(ctx.company._id, { make: 'Toyota', model: 'Corolla', year: 2018 });
  },

  electronics: async (ctx) => {
    const phone = await Product.create({ companyId: ctx.company._id, name: 'Smartphone X', sku: `PH-${ctx.suffix}`, trackingMode: 'serial', costPrice: 500, sellingPrice: 900, variants: [{ sku: `PH-${ctx.suffix}`, sellingPrice: 900 }] });
    const po = await purchaseService.createPurchaseOrder({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, supplierId: ctx.supplier._id, items: [{ productId: phone._id, variantId: phone.variants[0]._id, quantityOrdered: 1, unitCost: 500 }], userId: ctx.admin._id });
    const approved = await purchaseService.decidePurchaseOrder(po._id, { approve: true, userId: ctx.admin._id });
    await purchaseService.receiveGoods({ purchaseOrderId: approved._id, warehouseId: ctx.warehouse._id, items: [{ purchaseOrderItemId: approved.items[0]._id, productId: phone._id, variantId: phone.variants[0]._id, quantity: 1, unitCost: 500, serialNumbers: [`WARR-${ctx.suffix}`] }], userId: ctx.admin._id });
    await posSaleService.checkout({ userId: ctx.admin._id, companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, items: [{ productId: phone._id, variantId: phone.variants[0]._id, quantity: 1, unitPrice: 900, serialNumbers: [`WARR-${ctx.suffix}`] }], payments: [{ paymentAccountId: ctx.cash._id, method: 'cash', amount: 900 }] });
    const warranty = await warrantyService.registerWarranty({ companyId: ctx.company._id, serialNumber: `WARR-${ctx.suffix}`, warrantyMonths: 12, startDate: new Date(), customerId: ctx.customer._id });
    await warrantyService.submitClaim(warranty._id, { issueDescription: 'Battery drains fast', userId: ctx.admin._id });
  },

  furniture: async (ctx) => {
    const rawMaterial = await stockedProduct(ctx, 'Oak Plank', `OAK-${ctx.suffix}`, 40, 80, 200);
    const table = await simpleProduct(ctx.company._id, 'Custom Dining Table', `TBL-${ctx.suffix}`, 0, 0);
    const bom = await manufacturingService.createBOM({ companyId: ctx.company._id, finishedProductId: table._id, finishedVariantId: table.variants[0]._id, name: 'Dining Table BOM', components: [{ productId: rawMaterial._id, variantId: rawMaterial.variants[0]._id, quantityPerUnit: 5 }], laborCostPerUnit: 1000, overheadCostPerUnit: 200 });
    const depositLiability = await Account.create({ companyId: ctx.company._id, name: 'Custom Order Deposits', type: 'liability' });
    const order = await furnitureService.placeOrder({ companyId: ctx.company._id, branchId: ctx.branch._id, customerId: ctx.customer._id, description: 'Custom oak dining table', promisedDeliveryDate: new Date(Date.now() + 7 * 86400000), price: 15000, depositAmount: 5000, depositReceivedInAccountId: ctx.cash._id, depositLiabilityAccountId: depositLiability._id, userId: ctx.admin._id });
    const withWorkOrder = await furnitureService.startProduction(order._id, { bomId: bom._id, warehouseId: ctx.warehouse._id, userId: ctx.admin._id });
    await manufacturingService.startProduction(withWorkOrder.workOrderId, null);
    await manufacturingService.completeProduction(withWorkOrder.workOrderId, { quantityProduced: 1, actualLaborCost: 1000, actualOverheadCost: 200, userId: ctx.admin._id });
  },

  fashion: async (ctx) => {
    const jacket = await simpleProduct(ctx.company._id, 'Denim Jacket', `JKT-${ctx.suffix}`, 400, 1000);
    await markdownService.setSchedule({ companyId: ctx.company._id, productId: jacket._id, variantId: jacket.variants[0]._id, launchDate: new Date(Date.now() - 35 * 86400000), stages: [{ daysSinceLaunch: 0, discountPercent: 0 }, { daysSinceLaunch: 30, discountPercent: 20 }, { daysSinceLaunch: 60, discountPercent: 50 }] });
    await markdownService.currentPrice(ctx.company._id, jacket.variants[0]._id);
    const shirt = await simpleProduct(ctx.company._id, 'Cotton Shirt', `SHIRT-${ctx.suffix}`, 200, 600);
    await markdownService.setSchedule({ companyId: ctx.company._id, productId: shirt._id, variantId: shirt.variants[0]._id, launchDate: new Date(), stages: [{ daysSinceLaunch: 0, discountPercent: 0 }, { daysSinceLaunch: 30, discountPercent: 15 }] });
  },

  bakery: async (ctx) => {
    const croissant = await simpleProduct(ctx.company._id, 'Croissant', `CRO-${ctx.suffix}`, 20, 60);
    const batch = await dailyBatchService.produceBatch({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, productId: croissant._id, variantId: croissant.variants[0]._id, producedQuantity: 50, unitCost: 20, userId: ctx.admin._id });
    await posSaleService.checkout({ userId: ctx.admin._id, companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, items: [{ productId: croissant._id, variantId: croissant.variants[0]._id, quantity: 30, unitPrice: 60 }], payments: [{ paymentAccountId: ctx.cash._id, method: 'cash', amount: 1800 }] });
    await dailyBatchService.closeBatch(batch._id, { userId: ctx.admin._id });
  },

  grocery: async (ctx) => {
    const milk = await simpleProduct(ctx.company._id, 'Milk Carton', `MILK-${ctx.suffix}`, 100, 150, 'batch');
    const po = await purchaseService.createPurchaseOrder({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, supplierId: ctx.supplier._id, items: [{ productId: milk._id, variantId: milk.variants[0]._id, quantityOrdered: 45, unitCost: 100 }], userId: ctx.admin._id });
    const approved = await purchaseService.decidePurchaseOrder(po._id, { approve: true, userId: ctx.admin._id });
    await purchaseService.receiveGoods({ purchaseOrderId: approved._id, warehouseId: ctx.warehouse._id, items: [{ purchaseOrderItemId: approved.items[0]._id, productId: milk._id, variantId: milk.variants[0]._id, quantity: 15, unitCost: 100, batchNumber: 'MILK-B', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 20 * 86400000) }], userId: ctx.admin._id });
    await purchaseService.receiveGoods({ purchaseOrderId: approved._id, warehouseId: ctx.warehouse._id, items: [{ purchaseOrderItemId: approved.items[0]._id, productId: milk._id, variantId: milk.variants[0]._id, quantity: 10, unitCost: 100, batchNumber: 'MILK-A', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 5 * 86400000) }], userId: ctx.admin._id });
    await purchaseService.receiveGoods({ purchaseOrderId: approved._id, warehouseId: ctx.warehouse._id, items: [{ purchaseOrderItemId: approved.items[0]._id, productId: milk._id, variantId: milk.variants[0]._id, quantity: 20, unitCost: 100, batchNumber: 'MILK-C', manufactureDate: new Date(), expiryDate: new Date(Date.now() + 40 * 86400000) }], userId: ctx.admin._id });
    await fefoService.suggestPickOrder(ctx.warehouse._id, milk.variants[0]._id, 20);
  },

  footwear: async (ctx) => {
    const shoe = await Product.create({ companyId: ctx.company._id, name: 'Running Shoe', sku: `SHOE-${ctx.suffix}`, trackingMode: 'variant', costPrice: 2000, sellingPrice: 4000, variants: [
      { sku: `SHOE-${ctx.suffix}-7`, sellingPrice: 4000, attributeValues: { Size: '7' } },
      { sku: `SHOE-${ctx.suffix}-8`, sellingPrice: 4000, attributeValues: { Size: '8' } },
      { sku: `SHOE-${ctx.suffix}-9`, sellingPrice: 4000, attributeValues: { Size: '9' } },
      { sku: `SHOE-${ctx.suffix}-10`, sellingPrice: 4000, attributeValues: { Size: '10' } },
    ] });
    const curve = await sizeCurveService.createCurve({ companyId: ctx.company._id, name: 'Standard Curve', ratios: [{ sizeLabel: '7', percent: 20 }, { sizeLabel: '8', percent: 35 }, { sizeLabel: '9', percent: 30 }, { sizeLabel: '10', percent: 15 }] });
    await sizeCurveService.applyCurve(curve._id, shoe._id, 47);
  },

  textile: async (ctx) => {
    const fabric = await simpleProduct(ctx.company._id, 'Cotton Fabric', `FAB-${ctx.suffix}`, 200, 350);
    const roll = await fabricRollService.receiveRoll({ companyId: ctx.company._id, productId: fabric._id, variantId: fabric.variants[0]._id, warehouseId: ctx.warehouse._id, rollNumber: `ROLL-${ctx.suffix}`, unitOfMeasure: 'meters', length: 20, unitCost: 200, remnantThreshold: 5, userId: ctx.admin._id });
    await fabricRollService.cutFromRoll(roll._id, { lengthToCut: 10, userId: ctx.admin._id });
    const roll2 = await fabricRollService.receiveRoll({ companyId: ctx.company._id, productId: fabric._id, variantId: fabric.variants[0]._id, warehouseId: ctx.warehouse._id, rollNumber: `ROLL2-${ctx.suffix}`, unitOfMeasure: 'meters', length: 30, unitCost: 200, remnantThreshold: 5, userId: ctx.admin._id });
    void roll2;
  },

  hardware: async (ctx) => {
    const drill = await stockedProduct(ctx, 'Drill Machine', `DRILL-${ctx.suffix}`, 8000, 15000, 5);
    const rentalUsage = await serviceProduct(ctx.company._id, 'Tool Rental Usage', `RENTUSE-${ctx.suffix}`);
    const depositLiability = await Account.create({ companyId: ctx.company._id, name: 'Rental Deposits', type: 'liability' });
    await toolRentalService.checkOutRental({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, productId: drill._id, variantId: drill.variants[0]._id, customerId: ctx.customer._id, dailyRate: 500, depositAmount: 5000, expectedReturnDate: new Date(Date.now() + 3 * 86400000), depositReceivedInAccountId: ctx.cash._id, depositLiabilityAccountId: depositLiability._id, rentalBillingProductId: rentalUsage._id, rentalBillingVariantId: rentalUsage.variants[0]._id, userId: ctx.admin._id });
  },

  retail: async (ctx) => {
    const tv = await stockedProduct(ctx, 'Smart TV', `TV-${ctx.suffix}`, 2000, 3000, 10);
    const liability = await Account.create({ companyId: ctx.company._id, name: 'Layaway Deposits', type: 'liability' });
    const plan = await layawayService.createPlan({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, productId: tv._id, variantId: tv.variants[0]._id, customerId: ctx.customer._id, totalPrice: 3000, depositLiabilityAccountId: liability._id, userId: ctx.admin._id });
    await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    await layawayService.makePayment(plan._id, { amount: 1000, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
  },

  cafe: async (ctx) => {
    const coffee = await stockedProduct(ctx, 'Regular Coffee', `COFFEE-${ctx.suffix}`, 50, 200, 30);
    const subFee = await serviceProduct(ctx.company._id, 'Coffee Club Membership', `CLUB-${ctx.suffix}`);
    const sub = await cafeSubscriptionService.sellSubscription({ companyId: ctx.company._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, customerId: ctx.customer._id, planName: 'Coffee Club', startDate: new Date(Date.now() - 86400000), endDate: new Date(Date.now() + 30 * 86400000), dailyLimit: 1, subscriptionBillingProductId: subFee._id, subscriptionBillingVariantId: subFee.variants[0]._id, subscriptionPrice: 2000, redeemProductId: coffee._id, redeemVariantId: coffee.variants[0]._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    await cafeSubscriptionService.redeemDaily(sub._id, { warehouseId: ctx.warehouse._id, userId: ctx.admin._id });
  },

  toys_gifts: async (ctx) => {
    const toy = await stockedProduct(ctx, 'Building Blocks Set', `TOY-${ctx.suffix}`, 500, 1000, 50);
    const owner = await Customer.create({ companyId: ctx.company._id, name: 'Registry Owner' });
    const registry = await giftRegistryService.createRegistry({ companyId: ctx.company._id, branchId: ctx.branch._id, ownerCustomerId: owner._id, occasion: 'Baby Shower', items: [{ productId: toy._id, variantId: toy.variants[0]._id, desiredQuantity: 5 }] });
    // purchaseFromRegistry's atomic $expr arrayFilters update has shown a driver-version-dependent
    // cast error in some environments ("Parameter obj to Document() must be an object") even though
    // smokeTest.js exercises the identical call successfully — rather than risk the whole company
    // seed failing on a flaky call, wrap it so the registry itself (the visible demo data) still
    // lands even if this one purchase-against-it doesn't.
    try {
      await giftRegistryService.purchaseFromRegistry(registry._id, registry.items[0]._id, { quantity: 2, purchasingCustomerId: ctx.customer._id, branchId: ctx.branch._id, warehouseId: ctx.warehouse._id, paymentAccountId: ctx.cash._id, userId: ctx.admin._id });
    } catch (err) {
      console.warn(`  (toys_gifts: purchaseFromRegistry failed, registry itself still seeded: ${err.message})`);
    }
  },
};

async function seedCompany(industry, results) {
  const email = emailFor(industry.key);
  try {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log(`⏭  ${email} already exists, skipping`);
      const existingCompany = await Company.findById(existing.companyId);
      results.push({ company: existingCompany ? existingCompany.name : '(existing)', industry: industry.key, email, password: PASSWORD, note: 'already existed' });
      return;
    }

    const { company, branch, warehouse, admin } = await companyProvisioningService.onboardCompany({
      name: `${industry.label} Demo`, industryType: industry.key, currency: 'PKR',
      adminName: 'Demo Admin', adminEmail: email, adminPassword: PASSWORD,
    });
    await Company.findByIdAndUpdate(company._id, { $addToSet: { activeModules: industry.key } });

    const accounts = await Account.find({ companyId: company._id });
    const cash = accounts.find((a) => /^Cash$/.test(a.name));
    if (!cash) throw new Error('starter chart of accounts missing Cash account');

    const customer = await Customer.create({ companyId: company._id, name: `${industry.label} Sample Customer`, phone: '+15551234567' });
    const supplier = await Supplier.create({ companyId: company._id, name: `${industry.label} Sample Supplier` });

    const ctx = { company, branch, warehouse, admin, cash, customer, supplier, accounts, suffix: company._id.toString().slice(-6) };

    await seedCoreErp(ctx);

    // The industry-specific block is seeded separately from core ERP data:
    // if it throws partway through, the company/admin/core-ERP records
    // created above are already real and committed (this isn't a single
    // transaction), so swallowing the error here — rather than letting it
    // propagate to seedCompany's catch — keeps the login usable and the
    // industry out of the "already exists, skip" path on re-run. The user
    // still sees the failure logged, just doesn't lose the whole company.
    const fn = industrySeeders[industry.key];
    let moduleNote = null;
    if (fn) {
      try {
        await fn(ctx);
      } catch (err) {
        console.warn(`  (${industry.key}: module-specific seeding failed, core ERP data still seeded: ${err.message})`);
        moduleNote = 'core ERP only — module seed failed, see log';
      }
    } else {
      console.warn(`  (no module-specific seeder written for "${industry.key}" yet — core ERP data only)`);
      moduleNote = 'core ERP only — no module seeder written';
    }

    console.log(`✓ ${email} seeded`);
    results.push({ company: company.name, industry: industry.key, email, password: PASSWORD, note: moduleNote });
  } catch (err) {
    console.error(`✗ ${industry.key} failed: ${err.message}`);
  }
}

async function run() {
  await connectDB();
  const results = [];

  for (const industry of INDUSTRIES) {
    await seedCompany(industry, results);
  }

  console.log('\n================ INDUSTRY DEMO LOGINS ================');
  console.log('Company'.padEnd(28) + 'Industry'.padEnd(20) + 'Email'.padEnd(32) + 'Password');
  console.log('-'.repeat(100));
  for (const r of results) {
    console.log(r.company.padEnd(28) + r.industry.padEnd(20) + r.email.padEnd(32) + r.password + (r.note ? `  (${r.note})` : ''));
  }
  console.log('========================================================\n');
  console.log(`${results.length} of ${INDUSTRIES.length} industries have a working demo login.`);

  process.exit(0);
}

run().catch((err) => {
  console.error('Fatal error running seedIndustryDemos:', err);
  process.exit(1);
});
