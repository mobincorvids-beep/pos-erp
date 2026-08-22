# Industry Demo Logins

Run `node src/seedIndustryDemos.js` (with `MONGO_URI` set in `.env`) to create these. Every login
uses the **same shared password** so it's easy to remember. Each is its own isolated company
(tenant) — log into one and you'll only see that industry's data, seeded with realistic sample
records so the screens aren't empty.

**Password for every account: `password123`**

| # | Industry | Login Email | What you'll see once seeded |
|---|----------|--------------|------------------------------|
| 1 | Restaurant | `restaurant@demo.test` | 3 tables (occupied/free/reserved) and an open kitchen order ticket for a burger |
| 2 | Pharmacy | `pharmacy@demo.test` | A patient record and a dispensed prescription (Amoxicillin + Paracetamol) linked to a real sale |
| 3 | Salon | `salon@demo.test` | A stylist, a haircut service billed with staff commission, and a sold 5-session membership package |
| 4 | Jewelry | `jewelry@demo.test` | A 22k gold ring priced live off today's gold rate, sold, plus a gold buy-back credit intake |
| 5 | Hotel | `hotel@demo.test` | Two rooms and a 3-night reservation with an advance deposit |
| 6 | Travel | `travel@demo.test` | A finalized Istanbul tour booking and a second pending tour package |
| 7 | Insurance | `insurance@demo.test` | A motor policy, an approved claim, and its payout voucher |
| 8 | Sports | `sports@demo.test` | Two courts and a booked 2-hour slot |
| 9 | Events & Ticketing | `media-entertainment@demo.test` | A concert with VIP/Standard tiers and booked tickets in each |
| 10 | Telecom | `telecom@demo.test` | A postpaid plan, a subscribed customer with recorded usage, and a generated monthly bill with overage |
| 11 | Time & Billing | `professional-services@demo.test` | Logged consulting time entries and a generated client invoice |
| 12 | Agriculture | `agriculture@demo.test` | A 10-acre field with a completed wheat crop cycle and yield variance |
| 13 | Import/Export | `import-export@demo.test` | A received shipment with landed-cost allocation across 2 items plus customs duty |
| 14 | Batch Recalls | `pharmaceutical@demo.test` | A recalled medicine batch with a traced affected-customer sale |
| 15 | Construction | `construction@demo.test` | A renovation project with a BOQ estimate vs. actual cost variance report |
| 16 | Logistics | `logistics@demo.test` | A delivery van, driver, and a completed profitable trip |
| 17 | Automobile | `automobile@demo.test` | A VIN-tracked sedan sale and a vehicle trade-in credit |
| 18 | Car Rental | `car-rental@demo.test` | A 2-vehicle Compact fleet with an active booking |
| 19 | Courier | `courier@demo.test` | A delivered shipment (full status chain) plus a second shipment in transit |
| 20 | Dairy | `dairy@demo.test` | Two milk collections priced by fat-content grade |
| 21 | Petrol Pump | `petrol-pump@demo.test` | A fuel dispenser with a closed shift billed from meter readings |
| 22 | 3PL Warehouse | `warehouse-3pl@demo.test` | A storage contract with received/released goods and a billed storage period |
| 23 | Hajj/Umrah | `hajj-umrah@demo.test` | An Umrah group with 2 enrolled pilgrims and a partial payment |
| 24 | Housing Society | `housing-society@demo.test` | 2 enrolled member houses, a generated maintenance invoice, and an open complaint |
| 25 | NGO | `ngo@demo.test` | A restricted "Education Fund" with a donation and a disbursement |
| 26 | Real Estate | `real-estate@demo.test` | A leased apartment with a security deposit, plus a second vacant unit |
| 27 | School | `school@demo.test` | 2 students, a Grade 5 tuition fee structure, and generated fee invoices |
| 28 | Distribution | `distribution@demo.test` | A wholesale product with a 3-tier price schedule and a quantity-tiered sales order |
| 29 | Banquet | `banquet@demo.test` | A venue and package with a 100-guest event booking + deposit |
| 30 | Service Station | `service-station@demo.test` | A registered vehicle with a completed service and an open job card |
| 31 | Hospital | `hospital@demo.test` | 2 checked-in OPD patients in the FIFO queue |
| 32 | Gym | `gym@demo.test` | A Morning Yoga class session with 2 enrolled members |
| 33 | Auto Parts | `auto-parts@demo.test` | 2 parts (brake pads, oil filter) with vehicle fitment records |
| 34 | Electronics | `electronics@demo.test` | A serial-tracked phone sold with an active warranty and submitted claim |
| 35 | Furniture | `furniture@demo.test` | A custom dining table order run through real BOM/production to delivery |
| 36 | Fashion | `fashion@demo.test` | 2 products with time-decay markdown schedules |
| 37 | Bakery | `bakery@demo.test` | A produced croissant batch, partial sale, and closed/written-off remainder |
| 38 | Grocery | `grocery@demo.test` | 3 milk batches with different expiry dates and a FEFO pick suggestion |
| 39 | Footwear | `footwear@demo.test` | A running shoe in 4 sizes with a size-curve allocation |
| 40 | Textile | `textile@demo.test` | 2 fabric rolls, one partially cut |
| 41 | Hardware | `hardware@demo.test` | A drill on rental with a deposit checkout |
| 42 | Retail | `retail@demo.test` | A Smart TV layaway plan with 2 partial payments made |
| 43 | Cafe | `cafe@demo.test` | A coffee subscription with a redeemed daily coffee |
| 44 | Toys & Gifts | `toys-gifts@demo.test` | A baby-shower gift registry with a partial purchase against it |

Every company above also has a generic sample customer, sample supplier, a received purchase
order, an approved expense, one employee, and one project — so the core ERP screens (Purchasing,
Expenses, HR, Projects) aren't empty either, not just the industry-specific module.
