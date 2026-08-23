# Industry Module CRUD Audit

Scripted check of `router.get/post/put/patch/delete` across every `src/modules/<key>/routes/`.
Confirms the systemic version of the boss's complaint: it isn't restaurant-specific — almost
every industry module can CREATE records but has **no way to edit or remove them** once made.

| Module | GET | POST | PUT/PATCH | DELETE |
|---|---|---|---|---|
| restaurant | 1→4 | 1→3 | 1→3 | 0→2 | ✅ FIXED THIS PASS (tables + new KOT order workflow) |
| service_station | 3 | 3 | 1 | 0 |
| agriculture | 3 | 3 | 0 | 0 |
| auto_parts | 2 | 1 | 0 | 1 |
| automobile | 1 | 2 | 0 | 0 |
| bakery | 1 | 2 | 0 | 0 |
| banquet | 4 | 5 | 0 | 0 |
| cafe | 1 | 2 | 0 | 0 |
| car_rental | 2 | 3 | 0 | 0 |
| construction | 3 | 1 | 0 | 0 |
| courier | 2 | 3 | 0 | 0 |
| dairy | 2 | 2 | 0 | 0 |
| distribution | 2 | 3 | 0 | 0 |
| electronics | 2 | 5 | 0 | 0 |
| fashion | 3 | 1 | 0 | 0 |
| footwear | 1 | 2 | 0 | 0 |
| furniture | 2 | 4 | 0 | 0 |
| grocery | 1 | 0 | 0 | 0 |
| gym | 3 | 4 | 0 | 0 |
| hajj_umrah | 2 | 4 | 0 | 0 |
| hardware | 1 | 2 | 0 | 0 |
| hospital | 2 | 4 | 0 | 0 |
| hotel | 3 | 7 | 0 | 0 |
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
