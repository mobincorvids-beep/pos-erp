# Pakistani tax-authority integrations: status and honest limitations

This POS submits sales to five tax authorities: FBR (federal, goods) and
SRB / PRA / KPRA / BRA (provincial, services). Their integration maturity
is **not** the same, and it's important to be explicit about that before
relying on this for legal compliance.

## FBR (`../fbrService.js`)

FBR publishes a real, documented "Digital Invoicing" POS integration API
(operated by PRAL). `fbrService.js` is built to match FBR's publicly known
schema as closely as possible: sandbox/production base URLs (`FBR_ENV`),
the richer invoice payload shape (seller/buyer fields, per-item HS code,
UoM, sales-tax breakdown, scenario ID), and the invoice-number/QR-code
response fields.

**This still has not been validated against a live FBR account.** Before
going live:
1. Register for FBR's sandbox and obtain a bearer token (`FBR_API_TOKEN`).
2. Leave `FBR_ENV=sandbox` (the default) and post real invoices there.
3. Compare FBR's actual responses/rejections against the field mapping in
   `buildInvoicePayload` and adjust anything that doesn't match: in
   particular `scenarioId`, `sellerProvince`, HS codes, and the QR code
   format, none of which this codebase can guess correctly without your
   actual registration details.
4. Only then switch to `FBR_ENV=production`.

## SRB / PRA / KPRA / BRA (`srbService.js`, `praService.js`, `kpraService.js`, `braService.js`, `authorityFactory.js`)

Unlike FBR, the four provincial revenue authorities do **not** have a
single, uniformly documented, publicly known real-time e-invoicing API.
Each province's system is different, some are portal-only with no API,
some require SOAP/XML, and the real endpoint URLs and payload field names
are only available from each authority's own developer documentation,
typically issued **after** a business completes tax registration with
that authority. They are not public, and this codebase, or any AI system
— cannot correctly guess them.

Accordingly:
- The `defaultBaseUrl` values baked into each service file are **unverified
  placeholders**, not confirmed real endpoints. Always override them via
  the corresponding `*_API_BASE_URL` env var once you have the authority's
  real URL.
- `buildInvoicePayload`'s field names are a reasonable generic guess, not
  a verified schema, and will need adjusting per authority.
- Set `TAX_AUTHORITY_DRY_RUN=true` to log the exact payload each service
  would send instead of making a network call. Use this so your (or your
  client's) compliance team can review the payload shape against the
  authority's real documented API before ever pointing this at a live
  endpoint.
- Basic input validation now runs before any submission attempt (STRN/NTN
  present, invoice number set, items non-empty) so a misconfigured company
  fails fast with a clear error instead of sending a malformed request.

**This is a legal/compliance matter, not something that can be guessed
correctly from public sources.** Obtaining each province's real API specs
directly from that authority, after registering, is a required step before
these four integrations can be considered production-ready, this codebase
gives you a working, configurable skeleton to plug that documentation into,
not a finished, verified integration.

## Retry / reconciliation

- `fbrService.findUnsubmittedSales(companyId)`: completed sales never
  submitted to FBR.
- `taxComplianceService.findPendingComplianceSales(companyId)`: completed
  sales missing a submission for any authority the company is registered
  with (FBR and/or the provincial ones), for use from a cron or admin
  "retry failed submissions" action.
