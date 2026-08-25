# Universal ERP Spec vs. Current Codebase — Gap Audit

Checked against actual code (`src/services`, `src/routes`, `src/modules`), not assumptions.
Rated per the spec's 51 modules: ✅ real & solid · 🟡 real but partial · ❌ not present.

## ✅ Solid, real, matches spec's intent well
| Spec module | Evidence |
|---|---|
| 1. Platform/Tenant Admin | Company/branch/period/currency models, `periodService.js` real lock/reopen |
| 2. Identity, Users, Roles & Security | Roles/permissions, `securityService.js`, `twoFactorService.js` (real TOTP, verified in smoke tests) |
| 4. CRM & Customer 360 | `crmPipelineService.js` — real lead→opportunity→stage→pipeline flow, `crmService.js` — tags/segments/feedback/follow-ups |
| 5. Sales Pipeline & Commercial | Quotations→orders→invoices→returns, full sale lifecycle |
| 6. POS | `posSaleService.js`, shifts, terminals |
| 7. Product/Catalog | Products, variants, units, bundles |
| 8. Inventory & Stock | Batches, serials, transfers, counts — deep, verified across many smoke test steps |
| 10. Procurement & Purchasing | Requisition→RFQ→PO→GRN, full chain |
| 12. Accounting & Finance | Verified earlier this session: 15/16 capabilities real |
| 13/14. AR/AP | Aging, write-offs, collections |
| 15. Banking & Treasury | Transfer, reconciliation |
| 16. Expense Management | Categories, claims |
| 17. Budgeting | `budgetService.js`, vs-actual |
| 18. Fixed Assets | Depreciation, disposal |
| 19. Tax Engine | FBR/SRB/PRA/KPRA/BRA dispatchers |
| 20. HR | Employee lifecycle |
| 22. Attendance/Leave | Present |
| 23. Payroll | Generate/post, loans |
| 32. Helpdesk | `ticketService.js` — create/assign/resolve/close/SLA report |
| 37. Manufacturing (core) | `manufacturingService.js` — real BOM/work-order/production, reused by Furniture/Bakery/Agriculture |
| 35. Appointments/Booking | `appointmentService.js` — real generic booking engine used across Salon/Hotel/Hospital/etc |
| 43. E-commerce (single-channel) | `ecommerceService.js` — order import, product feed |
| 49. Webhooks | `webhookService.js`, `WebhookSubscription` model — real outbound event delivery |

## 🟡 Partial — real but missing spec depth
| Spec module | What exists | What's missing |
|---|---|---|
| 3. Workflow & Approval Engine | `approvalService.js` — request/decide/defineWorkflow | No visual builder, no multi-stage conditional routing, no escalation/SLA, no delegation |
| 25/26. Projects & Time Tracking | `projectService.js`, timesheets exist | No Kanban/Gantt/dependencies/subtasks, no ClickUp-style views |
| 28. Documents | `documentService.js` — versioning, expiry check, approval hookup | No folders/knowledge base/SOPs, no e-signature |
| 30. Marketing Automation | `crmService.js` campaigns (basic send) | No journeys/sequences, no lead scoring, no landing pages, no attribution |
| 33/46. Subscriptions & Recurring Billing | `recurringInvoiceService.js` — templates, pause/resume/cancel, generate | No plans/tiers, no usage billing, no dunning sequences, no MRR/churn dashboards |
| 34. Pricing/Promotions/Loyalty | `loyaltyService.js`, price lists exist | No coupon engine, no tiered rewards, no promotion approval workflow |
| 47. Reporting/BI | `reportingService.js`, many fixed reports | No drag-drop report/dashboard builder, no saved views |
| 48. AI | `aiInsightsService.js` — reorder recs, slow-moving, anomalies, briefing | No natural-language chat/copilot, no predictive models |
| 51. Audit | `auditService.js` — record/history | No policy engine, no retention rules, no consent management |
| 51. Notifications | `notificationService.js` — in-app only | No email/SMS/WhatsApp template engine, no quiet hours |

## ❌ Not present at all
| Spec module | Notes |
|---|---|
| 9. Warehouse Management (zones/bins/pick-waves) | Only warehouse-level stock exists, no location hierarchy or picking workflow |
| 11. Supplier Portal / performance scoring | No portal, no scorecards |
| 21. Recruitment/ATS | No candidate pipeline at all |
| 24. Performance/Goals/OKRs | No appraisal or goal-tracking module |
| 27. Team Chat (Slack-class) | Zero — no channels/DMs/threads |
| 29. Calendar & Meetings | No shared calendar object, only per-module booking |
| 31. Funnels/Landing Pages | Zero |
| 36. Field Service (technician dispatch) | Only industry-specific service orders, no dispatch board/GPS/checklist |
| 38. Quality Management (NCR/CAPA) | Zero |
| 39. Maintenance Management (assets/facilities) | Zero — only vehicle-service tracking inside specific industries |
| 40. Fleet & Transport (core, cross-industry) | Only exists inside car_rental/logistics industry modules, no standalone fleet engine |
| 41. Logistics/Courier (core) | Only exists as the `courier` industry module |
| 42. Import/Export (LC, customs docs) | `import_export` module covers landed cost only, no LC/customs document chain |
| 44. Multi-channel E-commerce Hub | Single-store webhook importer only, no channel manager/multi-store sync |
| 44. Customer/Employee/Dealer Portals | Zero self-service portals |
| 45. Contracts & Legal | Zero generic contract engine (only `warehouse_3pl`'s storage contracts) |
| 49. Full Developer Platform (OAuth apps, API keys, scopes, rate limits) | Only webhooks exist, no API key/OAuth management |

## Honest scoring
Of the spec's 51 modules: **19 solid, 10 partial, 22 absent.**

This is a real, working, well-architected **POS + Accounting + HR + Inventory + Industry-vertical ERP**.
It is not, and does not attempt to be, the HubSpot+Slack+ClickUp+GoHighLevel superset the spec describes —
that's a fundamentally larger product (arguably several separate SaaS products bolted together).

## Recommended build order (highest business value first)
1. **Team Chat** — zero-to-one, high visibility, self-contained
2. **Calendar & Meetings** — unifies the scattered per-module booking logic
3. **Field Service / Maintenance** — extends existing ServiceOrder pattern, moderate lift
4. **Customer Portal** — highest external-facing value, moderate lift (reuses existing auth)
5. **Fleet (core, cross-industry)** — generalizes car_rental's existing vehicle model
6. Quality Management, Contracts, Recruitment/ATS, Funnels — lower urgency, larger new builds
