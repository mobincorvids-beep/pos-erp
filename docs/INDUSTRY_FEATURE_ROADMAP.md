# Industry Feature Roadmap

Every business on this platform already gets the shared core for free, regardless of industry: products & multi-warehouse inventory, POS checkout, sales & purchase orders, customers & suppliers with ledgers, invoicing, quotations, accounting (chart of accounts, journal, P&L, balance sheet, cost centers, budgets), banking & reconciliation, HR & payroll & attendance, CRM & pipeline, projects, HR/recruitment/performance, reporting, multi-branch, and role-based permissions. That backbone is real and already covers a large share of "running the business" for any industry.

What's listed below, per industry, is the **specific layer on top of that core** — the part that makes a jewelry shop actually run like a jewelry shop instead of a generic retail shop with a jewelry-flavored label. For each industry: **Live today** is exactly what exists in the codebase right now (verified against the actual route files, not guessed). **To build** is what's still missing for an owner to say "yes, my whole business runs on this" — matched against what a dedicated best-in-class system for that trade actually offers.

Industries are grouped by trade family for readability; build order should follow whichever grouping covers the most active tenants first, not necessarily this order.

---

## Retail & Trade

### Jewelry
**Live:** live gold-rate pricing, making-charge/stone-charge config per item, old-gold buyback quoting & credit.
**To build:** hallmarking/purity certificate tracking & printing per item, karat-wise stock valuation report, repair & polish job orders (drop-off → estimate → done → collected), gold savings/committee scheme (customer pays monthly, redeems in gold at maturity), consignment/approval-basis items (taken home, not yet sold), diamond/stone certification (GIA/IGI number, clarity, carat) per line item, old-for-new exchange combined into one sale transaction (not just a separate buyback credit), insured high-value item register, loose-stone inventory separate from set jewelry.

### Retail (general shop)
**Live:** layaway/reservation plans with installment tracking.
**To build:** multi-location stock transfer requests with approval, barcode label printing/design, promotions engine (buy-X-get-Y, bundle pricing — beyond the existing flat coupons), supplier scorecards (on-time %, defect rate), shrinkage/loss tracking separate from stocktakes, customer wishlists, gift receipts, seasonal/planogram-style category performance reports.

### Grocery
**Live:** FEFO (first-expiry-first-out) pick-order suggestion.
**To build:** weighing-scale integration for loose produce (price-by-weight at checkout), short-shelf-life auto-markdown scheduling, supplier delivery-day calendar with auto-draft POs, basket-analysis / frequently-bought-together report, own-brand vs. national-brand margin split reporting, local delivery/click-and-collect order queue.

### Fashion (apparel)
**Live:** time-staged markdown schedules, live current-price lookup per variant.
**To build:** size/color matrix stock view (grid, not flat list), seasonal collection & buying-plan tracking, style-level (not just SKU-level) sales performance, consignment-from-designer stock, alteration/tailoring job tickets, loyalty-tier-based early access to new drops.

### Footwear
**Live:** size-curve templates, apply-curve-to-order to auto-split a bulk order across sizes.
**To build:** brand/style-level sell-through reporting, half-size and wide-fit variant handling, warranty/defect return workflow to brand/supplier, foot-measurement customer profile for repeat fitting, seasonal collection buy planning shared with Fashion.

### Electronics
**Live:** serial-number warranty registration, warranty check by serial, claims with approve/reject, claim-to-repair-job conversion.
**To build:** trade-in/exchange valuation (old device credit toward new, like Automobile's trade-ins), extended-warranty upsell at point of sale, IMEI/serial blacklist check (stolen/blocked device), accessory bundle suggestions at checkout, supplier RMA (return merchandise authorization) tracking, installment/EMI plan support at sale.

### Hardware (tool rental)
**Live:** tool checkout/return with deposit and damage-based partial forfeit.
**To build:** rental calendar/availability view across all tools, overdue-rental auto-alerts, tool maintenance/service log (separate from customer rentals), bulk contractor accounts with monthly consolidated billing, kit/bundle rentals (a "starter kit" as one rentable unit).

### Toys & Gifts
**Live:** gift registries with item wishlist and purchase-tracking.
**To build:** gift wrapping as a chargeable line item, age-range/category browsing filters, seasonal (birthday/holiday) demand forecasting, loyalty punch-card for repeat kids'-party customers, registry thank-you-note tracking.

### Furniture
**Live:** custom orders with production-start → ready → delivered stages, on-time delivery rate report.
**To build:** delivery scheduling with route/truck assignment, showroom floor-sample vs. warehouse-stock distinction, made-to-order fabric/finish selection captured on the order line, white-glove assembly service as a billable add-on, damage-in-transit claim workflow.

### Textile (fabric trade)
**Live:** fabric rolls received and cut-from-roll tracking with remaining-length.
**To build:** loom/mill batch and dye-lot tracking (shade matching matters — two "same color" rolls from different lots aren't interchangeable), wholesale bulk-roll vs. retail-cut pricing tiers, GSM/width/composition spec per roll, remnant/off-cut clearance bin.

### Auto Parts
**Live:** vehicle fitment lookup (make/model/year → compatible parts), fitment registration per product.
**To build:** OEM vs. aftermarket part flagging with price comparison, core-charge/return tracking (returnable old part credit, standard in this trade), supplier catalog cross-reference by part number, warranty claim workflow shared pattern with Electronics.

---

## Food & Hospitality

### Restaurant
**Live:** table management with status, dine-in order-per-table with kitchen-item-status tracking, order-close to billing.
**To build:** full kitchen display system (KDS) view for cooks (not just status flags), menu item modifiers/customization (extra cheese, no onions) priced individually, delivery/takeaway order channel alongside dine-in, split-bill and merge-table support, recipe/ingredient costing tied to Manufacturing's BOM system, waiter tip pooling.

### Cafe
**Live:** subscription plans (daily coffee pass) with redemption and cancellation.
**To build:** loyalty punch-card (10th coffee free) distinct from the generic loyalty program, pre-order/pickup-time scheduling, seasonal/limited-time menu toggling, table-side QR ordering.

### Bakery
**Live:** daily production batches with wastage close-out.
**To build:** standing/recurring wholesale orders (hotels, cafes ordering daily bread), pre-order for custom cakes with deposit and pickup date, ingredient-freshness/shelf-life alerts distinct from Pharmacy's expiry tracking, production-plan vs. actual-sold variance report to right-size next day's batch.

### Hotel
**Live:** room status/availability, reservations with check-in/check-out, extra charges, cancellation with deposit handling.
**To build:** housekeeping task assignment tied to room status, channel-manager style rate calendar (different price by date/season), group/block booking for events, guest folio itemization (minibar, laundry, room service as separate lines before final bill), loyalty tier with room upgrades, OTA (Booking.com/Expedia-style) integration hooks.

### Banquet (events venue)
**Live:** venue & package catalog, bookings with completion/cancellation and deposit forfeiture.
**To build:** floor-plan/seating-chart tool, vendor coordination (catering, decor, sound as sub-contracted line items), event timeline/run-of-show checklist, multi-date recurring event series (weekly wedding season bookings), staffing roster per event.

---

## Health & Wellness

### Pharmacy
**Live:** patient & doctor registry, prescriptions with dispensing, near-expiry stock report.
**To build:** drug interaction / allergy warning at dispense time, controlled-substance register with regulatory reporting, refill reminders (SMS/WhatsApp) tied to prescription schedule, insurance/third-party payer claim submission, generic-substitution suggestion at dispense.

### Pharmaceutical (distributor/manufacturer)
**Live:** batch recall initiation, customer-level recall exposure tracking, return processing, recall close-out.
**To build:** GMP-style batch genealogy (which raw-material lots went into which finished batch — ties to Manufacturing), cold-chain temperature-log tracking for sensitive drugs, regulatory submission/approval status per product, adverse-event reporting log.

### Hospital / Clinic
**Live:** outpatient check-in queue, call-next, visit completion/cancellation.
**To build:** appointment scheduling (not just walk-in queue), doctor-wise daily schedule/availability, patient medical history & visit notes, lab-order and result tracking, ward/bed management for inpatients, insurance pre-authorization workflow.

### Salon
**Live:** service catalog with commission rules, membership packages, service billing with stylist commission, payroll-run commission application.
**To build:** stylist-specific appointment calendar (booking a specific person, not just a slot), product retail sales attributed to the stylist who recommended it, before/after photo log per client, client hair/skin profile & preference notes, no-show/late-cancellation fee policy.

### Gym / Fitness
**Live:** class catalog, scheduled sessions, enrollment with roster and waitlist, session cancellation.
**To build:** membership plans with freeze/pause, access-control check-in (QR/card swipe at the door, not just class enrollment), personal-training package sales separate from group classes, body-metrics tracking per member over time, equipment maintenance log.

---

## Automotive & Transport

### Automobile (dealership)
**Live:** trade-in appraisal, applying trade-in credit to a sale.
**To build:** full vehicle inventory with VIN, condition report, and photo gallery per unit, financing/loan-application tracking, test-drive scheduling and log, dealer-to-dealer stock transfer, after-sale service-department handoff (ties to Service Station).

### Car Rental
**Live:** fleet catalog, bookings with return processing and cancellation-with-deposit handling.
**To build:** vehicle condition photos at checkout/return (dispute protection), fuel-level policy tracking, GPS/mileage-cap overage billing, insurance add-on selection at booking, one-way rental with drop-off-location fee.

### Service Station (auto repair)
**Live:** vehicle registry with mileage log, service-due alerts, job cards, service-completed logging.
**To build:** estimate-approval-before-work workflow (customer signs off on cost before repair starts — currently jobs just proceed), parts-reservation against a job card tied to inventory, technician time-per-job tracking for productivity reporting, digital vehicle inspection checklist with photos.

### Petrol Pump
**Live:** dispenser registry, shift open/close with meter readings.
**To build:** tank-level/dip-reading reconciliation against dispensed volume (theft/leak detection), fuel-price-change history log (prices change daily in this trade), lubricant/convenience-store sales alongside fuel in the same shift close, fleet-card/corporate-account billing.

### Courier
**Live:** shipment creation, public tracking-number lookup, status advancement, delivery confirmation.
**To build:** route optimization / rider assignment by zone, proof-of-delivery photo/signature capture, cash-on-delivery reconciliation per rider per day, failed-delivery/return-to-sender workflow, real-time rider location (map view).

### Logistics (fleet & trips)
**Live:** vehicle & driver registry, trips with deliveries and completion.
**To build:** route planning with multiple stops per trip, fuel-efficiency reporting per vehicle, driver performance/on-time scorecard, vehicle maintenance schedule tied to odometer (shared pattern with Fleet in core), freight/cargo manifest per trip.

### Warehouse (3PL)
**Live:** client storage contracts, goods receive/release, per-day-per-unit fee calculation and billing.
**To build:** bin/zone-level location tracking inside the 3PL warehouse (shared pattern already exists in core Warehouse Locations — needs wiring to 3PL contracts), client-facing self-service portal to check their own stock levels, value-added services billing (repacking, labeling) beyond storage, inbound appointment scheduling for trucks.

---

## Manufacturing & Agriculture

### Agriculture / Farming
**Live:** field registry with yield history, crop cycles with BOM-based input consumption and harvest recording.
**To build:** weather-linked irrigation/spray scheduling, labor-gang assignment per field task, equipment (tractor/thresher) usage and maintenance log, produce grading at harvest (A/B/C grade pricing), farmer/landlord profit-sharing split for leased land.

### Dairy
**Live:** quality-based pricing schedules (fat %), farmer milk collection recording with automatic payment calculation.
**To build:** cold-chain temperature logging from collection to processing, route/collection-center management for multiple pickup points, processed-product yield tracking (litres of milk → kg of butter/cheese, ties to Manufacturing), adulteration/quality-test failure workflow.

### Construction
**Live:** Bill of Quantities (BOQ) with estimated-vs-actual variance tracking.
**To build:** site/project daily labor & equipment log, subcontractor payment milestones tied to work completion %, material delivery-to-site tracking (ties to core Stock Transfers), site safety/incident log, client progress-billing (bill by % complete, not just final invoice).

---

## Professional & Financial

### Professional Services (consulting/legal/accounting firms)
**Live:** time entry logging, unbilled/invoiced time views, client invoice generation from tracked time.
**To build:** matter/case/engagement tracking (grouping time entries under a named project beyond generic Projects), retainer-balance tracking (draw-down against a prepaid retainer), conflict-of-interest check when onboarding a new client, document/deliverable checklist per engagement.

### Insurance (agency)
**Live:** policy sales, claims with approve/reject decisions.
**To build:** policy renewal reminder pipeline, commission tracking per policy for the agent who sold it, underwriting document checklist (ID, inspection photos) before policy activation, multi-insurer product comparison at point of sale, claims-adjuster assignment and status workflow beyond a single approve/reject step.

### Real Estate (agency/brokerage)
**Live:** property listings, lease creation with rent generation and lease-end processing.
**To build:** sale (not just lease) transaction workflow with commission split between agent and brokerage, property viewing/showing scheduler, listing marketing (photos, virtual tour links, portal syndication), buyer/tenant matching against saved search criteria, offer/negotiation tracking.

### Housing Society (community management)
**Live:** member registry, recurring maintenance-charge invoicing with generate/pay, complaints with assign/resolve.
**To build:** society-wide announcements/notice board, common-area facility booking (community hall, gym), visitor/gate-pass log, society AGM voting/resolution tracking, vendor contract management (security, cleaning) as recurring society expenses.

---

## Travel & Recreation

### Travel Agency
**Live:** package bookings with finalize-and-bill and cancellation-with-refund handling.
**To build:** flight/hotel/visa sub-component itemization within one package, group tour roster with per-traveler document (passport, visa) checklist, itinerary builder with day-by-day schedule, supplier (airline/hotel) commission tracking, installment payment plans for package cost.

### Hajj & Umrah Operator
**Live:** pilgrimage group registry with enrollment, waitlisting, and installment payment tracking.
**To build:** per-pilgrim document checklist (passport, visa, vaccination), Mahram/group-relationship tracking for regulatory compliance, accommodation & transport sub-vendor assignment per group, guide/Muallim assignment, group departure-day manifest generation.

### Sports & Recreation Facilities
**Live:** facility catalog, slot booking, cancellation.
**To build:** recurring/season-long booking (same court every Tuesday for a league), tournament/league bracket management, equipment rental alongside facility booking, coaching-session booking distinct from open-facility booking, membership-tier facility-access pricing.

### Media & Entertainment (event ticketing/venues)
**Live:** show scheduling with tiered seating, per-tier ticket booking with waitlist, cancellation.
**To build:** seat-map (specific seat, not just tier-capacity) selection, season-pass/subscription ticketing, promoter/artist revenue-share settlement, box-office vs. online sales channel reporting, refund-policy tiers by how close to showtime.

---

## Education & Community

### School
**Live:** student enrollment, fee structures, fee-invoice generation with overdue flagging and payment, attendance recording.
**To build:** class/section timetable and subject-teacher assignment, gradebook/exam-result recording, parent-teacher communication log, library/book-issue tracking, transport/bus-route assignment with fee.

### NGO
**Live:** restricted/unrestricted fund registry, donation recording, disbursements, fund ledger.
**To build:** donor CRM (recurring-donor tracking distinct from generic customers), grant application & reporting-deadline tracker, beneficiary/program outcome tracking (who was helped, not just what was spent), volunteer registry & hour logging, donor tax-receipt generation.

---

## Trade & Distribution

### Import/Export
**Live:** import shipments with landed-cost allocation across items, receiving.
**To build:** export shipment side (not just import), customs documentation checklist (bill of lading, letter of credit, certificate of origin) per shipment, multi-currency exposure tracking as goods move through the pipeline, freight-forwarder performance tracking, HS-code duty-rate lookup.

### Distribution (wholesale)
**Live:** tiered/quantity-based pricing schedules, wholesale sales-order quoting.
**To build:** route-to-market/territory assignment for sales reps, van-sales (pre-loaded truck, invoice on delivery) workflow, credit-limit enforcement per distributor/retailer account beyond generic customer credit, promotional scheme (case discounts, free goods) at the distributor level.

---

## Telecom

### Telecom (subscriber/plan management)
**Live:** plan catalog, subscriptions with usage recording and monthly billing.
**To build:** SIM/number inventory and activation workflow, prepaid recharge/top-up alongside postpaid billing, plan upgrade/downgrade mid-cycle with prorated billing, usage-alert notifications (approaching data cap), porting-in/porting-out request tracking.

---

## How this gets built

This is 44 genuinely different verticals — building every "To build" item above to real depth is a multi-month program, not a single delivery. The practical path, matching how the rest of this platform has been built out:

1. **Pick a priority order.** Your own business's industry first makes sense, then whichever industries have the most active tenants.
2. **Build in rounds**, same as the translation work — a handful of the highest-value features per industry per round, verified building and deployed, rather than one enormous batch.
3. **Reuse shared infrastructure aggressively.** Several "to build" items above (route planning, document checklists, recurring billing, commission tracking, maintenance logs) are patterns that already exist once in the core system or in another industry module — wiring them up for a new vertical is much faster than building from scratch each time.

Tell me which industry (or industries) to start with and I'll begin building against this spec immediately.
