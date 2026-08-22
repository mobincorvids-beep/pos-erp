# Module Coverage Audit

Cross-references the uploaded ERP spec (`ERP_Multi_industry.txt`, sections 1–44: Universal ERP
Core through the Industry Configuration Engine) against what actually exists in this codebase.
Evidence is real files, not assumptions — every row cites the file(s) checked.

Legend: **✅ Implemented** — real, working backend service + model, exercised by `smokeTest.js`.
**🟡 Partial** — real code exists but is thinner than the spec describes, or covers only part of
the described scope. **❌ Missing** — no real implementation found.

| # | Spec Section | Status | Evidence |
|---|---------------|--------|----------|
| 1 | Organization & Multi-Tenancy | ✅ | `src/models/Company.js`, `Branch.js`, `Warehouse.js`, `PosTerminal.js`; `companyProvisioningService.js` onboards a full tenant per company |
| 2 | User, Role & Security Engine | ✅ | `src/services/securityService.js` (login attempts, alerts), `twoFactorService.js` (real TOTP), `refreshTokenService.js` (session mgmt), `src/models/Role.js` with permission arrays |
| 3 | Workflow & Approval Engine | ✅ | `src/services/approvalService.js` — multi-step, amount-threshold workflows, backward-compatible single-step fallback |
| 4 | Accounting & Finance Engine | ✅ | `accountingService.js`, `periodService.js`, `badDebtService.js`, `earlyPaymentDiscountService.js`, double-entry `Voucher` model used throughout |
| 5 | Sales & Commercial Engine | ✅ | `salesOrderService.js`, `saleCalculations.js`, `posSaleService.js`, `saleReturnService.js` |
| 6 | Universal POS Engine | ✅ | `posSaleService.js` (checkout, void, multi-payment, serial/batch handling), `src/routes/posRoutes.js` |
| 7 | Product & Inventory Engine | ✅ | `Product.js` with variants/serial/batch/weight tracking modes, `inventoryService.js`, `serialInventoryService.js`, `stockCountService.js`, `unitConversionService.js` |
| 8 | Procurement & Supplier Engine | ✅ | `purchaseService.js` (requisition→PO→GRN→QC), `requisitionService.js`, `rfqService.js` (multi-supplier compare + split PO conversion), `supplierLedgerService.js` |
| 9 | CRM & Customer Management | 🟡 | `crmService.js` covers campaigns (SMS/email) and tag-based segments and `customerLedgerService.js` covers AR, but there is **no Lead/Opportunity/Pipeline model** — the spec's Lead Capture, Lead Qualification, Opportunity Management, and CPQ sections (see `ERP_Multi_industry.txt` lines 5659–5931) have no backing model or service; only `RFQ`/`SupplierQuotation` (procurement-side, not sales-side) exist |
| 10 | Expense Management | ✅ | `expenseService.js` (submit/approve, project-tagged auto-costing) |
| 11 | HR & Payroll | ✅ | `hrService.js` — employees, attendance, payroll generation with absence deduction, posting to accounting |
| 12 | Manufacturing ERP | ✅ | `manufacturingService.js` — real BOM, work orders, production completion; reused unmodified by Furniture and Agriculture industry modules |
| 13 | Project Management | ✅ | `projectService.js` — budget, auto-cost capture from expenses/POs/sales, profitability |
| 14 | Construction ERP | ✅ | `src/modules/construction/services/billOfQuantitiesService.js` — BOQ estimate vs. actual variance report |
| 15 | Real Estate ERP | ✅ | `src/modules/real_estate/services/leaseService.js` — property lifecycle, lease, days-proportional late fees, deposit/damage settlement |
| 16 | Housing Society ERP | ✅ | `src/modules/housing_society/services/societyService.js` — member enrollment, idempotent batch billing, complaint work-order flow |
| 17 | Tax Engine | ✅ | `src/services/taxComplianceService.js` dispatches to `taxAuthorities/` (`fbrService.js`, `srbService.js`, `praService.js`, `kpraService.js`, `braService.js`) — real Pakistan multi-authority coverage, wired into `saleController.js` |
| 18 | Reporting & Business Intelligence Engine | ✅ | `reportingService.js` (low-stock, top products, salesperson, branch comparison, stock movement, trial balance), `reportExportService.js`, `dashboardService.js` (permission-scoped dashboard sections) |
| 19 | Multi-Branch & Consolidation | ✅ | `consolidatedReportService.js`, 20 models reference `Branch` |
| 20 | Supply Chain & Distribution | ✅ | `src/modules/distribution/services/distributionPricingService.js` — tiered pricing, MOQ enforcement, real Sales Order (reservation, not deduction) |
| 21 | Import & Export | ✅ | `src/modules/import_export/services/importShipmentService.js` — proportional landed-cost allocation with rounding-drift correction, real inventory cost-basis update |
| 22 | Courier ERP | ✅ | `src/modules/courier/services/shipmentService.js` — enforced status chain, terminal-state protection |
| 23 | Logistics & Fleet | ✅ | `src/modules/logistics/services/logisticsService.js` — trip costing, cost-per-km, odometer validation |
| 24 | Industry Applications (44 verticals) | ✅ | All 44 have a `src/modules/<key>/` backend module (or reuse core, e.g. Restaurant) AND a `client/src/pages/*Page.jsx` wired in `client/src/industryModuleRegistry.js`; every module is exercised in `smokeTest.js` |
| 25 | Automobile ERP (Dealership + Workshop) | ✅ | `src/modules/automobile/services/tradeInService.js` (trade-in credit) + `src/modules/service_station/services/vehicleService.js` (mileage-based service due, job cards) cover Workshop; Dealership reuses core serial-tracked checkout |
| 26 | Car Rental | ✅ | `src/modules/car_rental/services/carRentalService.js` — fleet pool availability, not single-resource calendar |
| 27 | Petrol Pump | ✅ | `src/modules/petrol_pump/services/fuelShiftService.js` — meter-reading-derived sales, shift open/close |
| 28 | Hotel ERP | ✅ | `src/modules/hotel/services/hotelService.js` — room availability, advance deposit→liability→revenue, check-in/out, housekeeping status cycle |
| 29 | Hospital & Clinic ERP | 🟡 | `src/modules/hospital/services/hospitalService.js` covers OPD (FIFO queue, consultation billing) well; the spec's **IPD** (admission/ward/bed management), **Diagnostics** (lab orders/results), and **OT** (operation theatre scheduling) sections (lines 1484–1523) have no corresponding models or services — only OPD is real |
| 30 | Education ERP | ✅ | `src/modules/school/services/schoolService.js` — idempotent batch fee invoicing, overdue flagging, attendance |
| 31 | Gym / Fitness | ✅ | `src/modules/gym/services/gymService.js` — capacity-constrained sessions with FIFO waitlist auto-promotion |
| 32 | Banquet / Event Management | ✅ | `src/modules/banquet/services/bookingService.js` — venue+package booking, per-headcount pricing, forfeit/refund cancellation voucher |
| 33 | Agriculture ERP | ✅ | `src/modules/agriculture/services/agricultureService.js` — field-level crop cycles via real Manufacturing costing, yield variance history |
| 34 | Dairy & Livestock ERP | 🟡 | `src/modules/dairy/services/dairyCollectionService.js` covers Dairy collection/grading well; the spec's separate **Livestock** section (animal registry, breeding, health records — lines 1638–1656) has no model or service at all |
| 35 | Travel Agency | ✅ | `src/modules/travel/services/travelService.js` — deposit-then-bill-remainder booking pattern |
| 36 | Hajj & Umrah | ✅ | `src/modules/hajj_umrah/services/pilgrimageService.js` — capacity+waitlist group enrollment combined with installment payments |
| 37 | AI Intelligence Layer | 🟡 | `src/services/aiInsightsService.js` provides real reorder recommendations, slow-moving inventory, sales anomaly detection, and a briefing digest — but this is rule-based analysis, not the spec's described conversational "AI Business Assistant" (natural-language Q&A, lines 1717–1728); no LLM-backed assistant endpoint exists |
| 38 | Notification Engine | ✅ | `src/services/notificationService.js` — real event-driven low-stock notifications (fires from actual checkout, deduped against unread), plus security-alert and document-expiry notifications reuse the same engine |
| 39 | Document Management | ✅ | `src/services/documentService.js` — real versioning (append, not overwrite), reuses the Workflow engine for approval and the Notification engine for expiry sweeps |
| 40 | Helpdesk & Service Management | ✅ | `src/services/ticketService.js` — real time-based SLA with breach detection, enforced assign→resolve→close sequence |
| 41 | API & Integration Engine | 🟡 | `src/services/webhookService.js` provides real outbound HMAC-signed webhooks (proven failure-handling in `smokeTest.js`) and `ecommerceService.js` provides a generic inbound order-import webhook; but the spec's **Payments** (real gateway integration — Stripe/PayPal/JazzCash), **Government** (e-invoicing beyond FBR), and named **E-commerce** platform connectors (Shopify/WooCommerce, lines 1826–1852) are not implemented — no gateway SDK or connector-specific code found (`grep -rl stripe\|paypal\|shopify\|woocommerce` returns nothing under `src/`) |
| 42 | Mobile Applications | ❌ | No React Native / Expo / mobile project found anywhere in the repo — Owner App, Sales App, Delivery App, Employee App, and Customer App (lines 1885–1933) are entirely unimplemented; this is a responsive React web app only |
| 43 | Industry Configuration Engine | ✅ | `Company.activeModules` array (set via `$addToSet` throughout `smokeTest.js` and `seedIndustryDemos.js`) plus the module-manifest pattern (`src/modules/*/manifest.js`, e.g. `restaurant/manifest.js`) that auto-registers each industry without hand-editing a central list; toggled from `client/src/admin/pages/AdminCompaniesPage.jsx` |
| 44 | Fixed Assets | ✅ | `src/services/fixedAssetService.js` — straight-line depreciation, dedup per period, 4-leg disposal voucher (gain/loss) |

## Summary

- **38 of 44** sections: fully **Implemented** with real, working backend services (all confirmed
  runnable in `smokeTest.js`, not just present as empty stubs).
- **5 sections Partial**: **CRM** (no Lead/Opportunity pipeline, only campaigns + ledger),
  **Hospital** (OPD only — no IPD/Diagnostics/OT), **Dairy & Livestock** (Dairy is real, Livestock
  is absent), **AI Layer** (rule-based insights, no conversational assistant), **API &
  Integration** (webhooks are real, but no payment gateway or named e-commerce connectors).
- **1 section Missing outright**: **Mobile Applications** — no mobile codebase of any kind.

### Honest gaps worth flagging to the user
1. **No Lead/Opportunity/CPQ pipeline** — if a tester expects a traditional sales-pipeline CRM
   (leads → opportunities → quotes), it isn't there. What exists is customer ledger + SMS/email
   campaigns.
2. **Hospital is OPD-only** — no admissions, wards, beds, lab orders, or OT scheduling.
3. **No Livestock module** — only milk collection/grading exists under Dairy.
4. **No mobile apps** — web-only (though responsive).
5. **No real payment gateway or named e-commerce platform connectors** — only a generic inbound
   webhook for order import and a generic outbound webhook for event delivery.
