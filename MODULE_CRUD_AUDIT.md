# Industry Module CRUD Audit

Scripted check of `router.get/post/put/patch/delete` across every `src/modules/<key>/routes/`.
Confirms the systemic version of the boss's complaint: it isn't restaurant-specific — almost
every industry module can CREATE records but has **no way to edit or remove them** once made.

| Module | GET | POST | PUT/PATCH | DELETE |
|---|---|---|---|---|
| restaurant | 1→4 | 1→3 | 1→3 | 0→2 | ✅ FIXED (tables + new KOT order workflow) |
| pharmacy | 3→5 | 3→5 | 0→3 | 0→2 | ✅ FIXED (doctors — was 100% missing; patient edit; prescription edit/cancel) |
| salon | 4 | 5 | 0→2 | 0→2 | ✅ FIXED (service + package edit/deactivate) |
| service_station | 3 | 3 | 1 | 0 |
| agriculture | 3 | 3 | 0 | 0 |
| auto_parts | 2 | 1 | 0 | 1 |
| automobile | 1 | 2 | 0 | 0 |
| bakery | 1 | 2 | 0 | 0 |
| banquet | 4 | 5 | 0→4 | 0→4 | ✅ FIXED (venue + package edit/deactivate) |
| cafe | 1 | 2→3 | 0 | 0 | ✅ FIXED (subscription cancel) |
| car_rental | 2 | 3 | 0 | 0 |
| construction | 3 | 1 | 0 | 0 |
| courier | 2 | 3 | 0 | 0 |
| dairy | 2 | 2 | 0 | 0 |
| distribution | 2 | 3 | 0 | 0 |
| electronics | 2 | 5 | 0 | 0 |
| fashion | 3 | 1 | 0 | 0 |
| footwear | 1 | 2 | 0 | 0 |
| furniture | 2 | 4 | 0 | 0 |
| grocery | 1 | 0 | 0 | 0 | ✅ AUDITED — this module is a pick-order report only, nothing to create/edit/delete, correctly no gap |
| gym | 3→4 | 4 | 0→2 | 0→1 | ✅ FIXED (class edit/deactivate, whole-session cancel) |
| hajj_umrah | 2 | 4 | 0 | 0 |
| hardware | 1 | 2→3 | 0 | 0 | ✅ FIXED (rental void) |
| hospital | 2 | 4 | 0 | 0 |
| hotel | 3→4 | 7 | 0→2 | 0→1 | ✅ FIXED (room edit/deactivate, reservation date/guest edit) |
| housing_society | 4 | 7 | 0 | 0 |
| import_export | 1 | 2 | 0 | 0 |
| insurance | 2 | 3 | 0 | 0 |
| jewelry | 3 | 5 | 0 | 0 |
| logistics | 3 | 5 | 0 | 0 |
| media_entertainment | 2 | 3 | 0 | 0 |
| ngo | 2 | 3 | 0 | 0 |
| petrol_pump | 2 | 3 | 0 | 0 |
| pharmaceutical | 2 | 3 | 0 | 0 |
| pharmacy | 3 | 3 | 0 | 0 |
| professional_services | 2 | 2 | 0 | 0 |
| real_estate | 2 | 4 | 0 | 0 |
| retail | 1 | 3 | 0 | 0 |
| salon | 4 | 5 | 0 | 0 |
| school | 4 | 6 | 0 | 0 |
| sports | 2 | 3 | 0 | 0 |
| telecom | 2 | 4 | 0 | 0 |
| textile | 1 | 2 | 0 | 0 |
| toys_gifts | 2 | 2 | 0 | 0 |
| travel | 1 | 3 | 0 | 0 |
| warehouse_3pl | 2 | 4 | 0 | 0 |

**Note:** this only covers each module's own industry-specific records (e.g. a Hotel's Room
Types, a Salon's Service Menu). It does NOT mean core objects (Products, Customers, Sales,
Expenses etc.) are missing edit/delete — those live in core routes/controllers, not the
industry modules, and mostly already have full CRUD (confirmed separately). This audit is
specifically about the per-industry extension data.

## Why this happened
Every module was built to prove out its core *workflow* (a hotel booking, a salon appointment,
a rental agreement) — the demo-critical path — with create+list. Editing a mistake or removing
a stale record was consistently left out across all 44, not missed in one.

## What was fixed this pass
- **Restaurant**: added the entire missing Kitchen Order Ticket workflow (model existed with
  zero controller/routes before this) — open an order against a table, send items to kitchen,
  advance per-item status, add more rounds, cancel, and close on billing. Table edit + delete
  added (delete refuses on an occupied table, matching the safety pattern used elsewhere in
  this codebase, e.g. Settings' "can't remove your last branch").
- **Pharmacy**: `Doctor` model existed (referenced by `Prescription.doctorId`) but had zero
  controller/routes — same pattern as Restaurant's KOT gap. Added full doctor CRUD (soft-delete,
  since past prescriptions reference them). Patient edit added — matters most for allergies/
  chronic conditions, the fields a pharmacy actually relies on to catch a dangerous prescription.
  Prescription edit + cancel added, but ONLY while status is still "pending" — once dispensing
  starts it's a billing record and stays immutable, same rule as Sale/SaleReturn elsewhere in
  this codebase.
- **Salon**: Service menu and Membership packages could be created but never corrected —
  added edit for both, and soft-deactivate instead of hard delete (a membership a customer
  already bought must keep resolving even after the package is pulled from sale).

- **Cafe**: `CafeSubscription.status` already had a `cancelled` value in its enum, but nothing
  ever set it — a mistakenly-sold subscription had no way to be stopped. Added a cancel action
  (not delete — the sale that paid for it stays in history either way).
- **Hardware**: `RentalAgreement` had no way back from a mistaken checkout — the item stayed
  permanently marked "out" of stock and the deposit liability stayed permanently open, with no
  path to return it. Added `voidRental`, restricted to still-`'out'` agreements only (once
  actually returned it's a closed transaction with its own real accounting, same "correct
  forward, not backward" rule as Sale). Reverses both real effects: restocks the item and
  reverses the deposit-received voucher.
- **Grocery**: audited, not a gap — this module is a read-only FEFO pick-order report with no
  records of its own to create, edit, or delete.

- **Hotel**: Room edit + soft-deactivate (refuses on an occupied room, same rule as Branch/Table).
  Reservation date/guest-count edit added — previously a wrong date range meant cancel-and-rebook,
  losing the original record. Only allowed while still `booked` (pre-arrival); re-checks room
  availability against the new dates before saving.
- **Gym**: GymClass edit + soft-deactivate. Added a whole-session cancel — previously only
  individual enrollments could be pulled one at a time, so a scheduling mistake (wrong time,
  instructor unavailable) had no way to be called off entirely.
- **Banquet**: Venue and Package edit + soft-deactivate added (Booking cancel already existed
  and was fine as-is).

## CORE SYSTEM FIXES (Aug 24) — more critical than any single industry module

Audited all 49 core route files the same way — the same scripted GET/POST/PUT/DELETE check
used above for industry modules. Found the same systemic gap in the app's three most-used
entities:

| Core entity | Before | After |
|---|---|---|
| **Products** | 0 edit, 0 delete | ✅ Full edit (name/price/SKU/stock levels), soft-deactivate, plus per-variant edit/deactivate and adding new variants to an existing product |
| **Customers** | 0 edit | ✅ Full edit (phone/email/address/credit limit/tags) |
| **Suppliers** | 0 edit | ✅ Full edit (phone/email/address) |
| **Departments** | 0 edit, 0 delete | ✅ Fixed |
| **Expense categories** | 0 edit, 0 delete | ✅ Fixed |
| **Units** | 0 edit, 0 delete | ✅ Fixed |

This mattered more than any industry module: Products, Customers, and Suppliers are used in
*every single business* on the platform, every day, regardless of industry — a typo'd product
price or a customer's changed phone number had **no way to be corrected** anywhere in the app
before this. All wired through to the UI (edit/remove buttons on Products, Customers, Suppliers,
Units pages), not just the API.

Deliberately excluded from editing (by design, not oversight):
- Product `trackingMode`/`hasVariants` — changing how stock is tracked after sales/movements
  already exist against a product would corrupt inventory history.
- Customer/Supplier `openingBalance` — these are ledger-derived running totals computed by
  `customerLedgerService`/`supplierLedgerService`, not free-text fields.

Other core route files (Sale, Purchase, CRM, HR, Payroll, etc.) show 0 PUT — audited and left
alone deliberately: those are financial/transactional documents (an invoice, a payslip) where
editing after posting is the wrong operation on purpose; the correct fix is a void/reversal
flow, which several of them already have (Sale has void, Prescription/Rental have cancel, etc.).
Not filed as gaps.


## Remaining 37 industry modules — not yet done
for records that may already be referenced by a Sale, a booking, an invoice, etc. — not a bulk
mechanical patch. Tell me which vertical(s) to do next.

## Recommended order for the remaining 43
Given the sheer size (43 modules × add update/delete endpoint + wire client UI each), doing
this correctly means going module by module rather than a bulk mechanical patch, because each
module's records have different safety rules for what "editable" and "deletable" mean (e.g. a
Hotel booking can't be deleted once checked in; a School fee invoice can't be deleted once paid
— same as Branch/Table above). Suggested batching by how much real traffic they'll see first:

1. **High-traffic verticals** you're likely to onboard soonest: retail, pharmacy, salon, cafe,
   grocery, hardware — busiest data-entry modules, most CRUD-critical.
2. **Booking/appointment-style verticals**: hotel, gym, banquet, travel, hajj_umrah, car_rental
   — these need edit (reschedule) more than delete.
3. **Everything else**, worked through systematically.

Tell me which vertical(s) to do next and I'll go as deep as I did on Restaurant — model, safety
rules for edit/delete, backend, and UI, verified with a real build each time.
