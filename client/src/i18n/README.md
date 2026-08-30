# i18n — how it works, and how to extend it

The app uses `react-i18next` / `i18next`. English (`en`) is the base and
fallback locale. Six Pakistani languages ship alongside it today:

| code  | language           | script            | direction |
|-------|---------------------|-------------------|-----------|
| `en`  | English              | Latin             | LTR       |
| `ur`  | Urdu                 | Perso-Arabic      | RTL       |
| `pnb` | Punjabi (Shahmukhi)  | Perso-Arabic      | RTL       |
| `sd`  | Sindhi               | Perso-Arabic      | RTL       |
| `ps`  | Pashto               | Perso-Arabic      | RTL       |
| `skr` | Saraiki              | Perso-Arabic      | RTL       |
| `bal` | Balochi              | Perso-Arabic      | RTL       |

Setup lives in `src/i18n/index.js`, imported once at the top of
`src/main.jsx`. Translation strings live in
`src/i18n/locales/<code>/translation.json` — one shared key namespace per
language, `en/translation.json` being the canonical key set every other
language file must match exactly (same keys, no more, no less).

## Scope of this pass

This infrastructure covers the whole app, but the actual `t()` conversion
so far only covers the highest-traffic surfaces:

- `src/components/Sidebar.jsx` — every nav section + item label
- `src/components/AppLayout.jsx` — hosts the `<LanguageSwitcher />`
- `src/pages/LoginPage.jsx` — the auth screen
- `src/pages/DashboardPage.jsx` — the role-aware dashboard
- `src/pages/PosPage.jsx` — the checkout/POS screen, including its `SetupBar`

Every other page (100+) is untouched and still renders raw English
strings. That's deliberate scope, not an oversight — see "Migrating
another page" below for how to bring one in without re-touching any of
the above.

## Translation key namespaces

- `common.*` — generic verbs/labels reused everywhere (Save, Cancel,
  Delete, Search, Loading…, etc). **Always check here first** before
  adding a new key — a `common.save` almost certainly already covers
  what you need.
- `nav.*` — sidebar section headers (`nav.sections.*`) and nav item labels
  (`nav.items.*`), plus `nav.home`, `nav.settings`, `nav.signOut`.
- `auth.*` — login/signup/forgot-password strings.
- `dashboard.*` — the DashboardPage and its role-specific sections.
- `pos.*` — the POS/checkout page and its SetupBar sub-component.

When migrating a new page, give it its own top-level namespace named
after the page (e.g. `products.*` for ProductsPage), and reuse `common.*`
keys wherever the string is generic rather than duplicating it under the
new namespace.

## Adding a new key

1. Add the key to `src/i18n/locales/en/translation.json` first — this is
   the source of truth for which keys exist.
2. Add the **same key path** to all six other locale files, with a real
   translation (not a placeholder, not a copy of the English text). Do
   not skip a language — a missing key falls back to English at runtime
   silently, which quietly re-introduces English-only UI.
3. Use it in the component with `const { t } = useTranslation();` then
   `t('namespace.key')`.
4. For interpolated values, use `{{placeholder}}` in the JSON and pass a
   second argument: `t('pos.charge', { amount: formatMoney(total, cur) })`.
5. For pluralization, define `key_one` and `key_other` in the JSON (all
   supported languages here use the same two-way plural rule i18next
   defaults to) and call the base key with a `count`:
   `t('pos.itemCount', { count: itemCount })` — i18next picks `_one` vs
   `_other` automatically.

There is a small script pattern for checking that every locale file has
exactly the same key set as `en` (used to verify this pass — see git
history for the one-off Python snippet); run something equivalent after
any bulk edit before shipping.

## Migrating another page

1. Pick (or create) a namespace for the page in each of the 7 locale
   JSON files (see "Translation key namespaces" above).
2. Add every hardcoded English string on the page as a key under that
   namespace in `en/translation.json`, then translate it into the other
   six files.
3. In the component: `import { useTranslation } from 'react-i18next';`,
   call `const { t } = useTranslation();` inside the component/function,
   and replace each literal string with `t('yourNamespace.key')`.
4. If the page has RTL-sensitive layout (icons that imply direction,
   fixed left/right offsets, asymmetric padding), prefer Tailwind's
   `rtl:`/`ltr:` variant classes over new global CSS — see the
   `rtl:border-l-0 rtl:border-r-4` pattern in `Sidebar.jsx` or the
   `rtl:!pl-3 rtl:!pr-11` pattern in `PosPage.jsx`'s search input. Only
   fall back to a `[dir="rtl"] .some-class { ... }` block in
   `src/index.css` for something that can't be expressed as a utility
   class (see the `.num` override there for an example — numbers must
   stay LTR-shaped even inside an RTL document).
5. Do not touch `Sidebar.jsx`, `AppLayout.jsx`, `LoginPage.jsx`,
   `DashboardPage.jsx`, or `PosPage.jsx` as a side effect of migrating an
   unrelated page — those are already converted; changes to them should
   only ever be about those specific pages.

## The language switcher

`src/components/LanguageSwitcher.jsx` is a plain `<select>` styled with
the app's existing `.field-input` class (no new colors/tokens
introduced). It lists every entry in `SUPPORTED_LANGUAGES`
(`src/i18n/index.js`), each shown by its **native name in its own
script** — never translated into English, and no flags (a shared script
across multiple provinces/countries makes flags actively misleading
here). Selecting an option calls `i18n.changeLanguage(code)`;
`i18next-browser-language-detector`'s `caches: ['localStorage']` config
then persists the choice under the `pos_erp_language` key automatically,
and reloads pick it back up on the next visit.

It's mounted in `AppLayout.jsx` (both the mobile topbar and a slim
desktop header) so every authenticated page gets it "for free" without
needing to import it. It's mounted separately in `LoginPage.jsx` since
that page renders outside `AppLayout` (no auth session yet).

## RTL

`src/i18n/index.js` registers an `i18n.on('languageChanged', ...)`
listener that sets `document.documentElement.dir` to `'rtl'` or `'ltr'`
and `document.documentElement.lang` to the active code, and calls that
same logic once eagerly on load (covering the detector's async initial
resolution). This means **any** component can rely on `dir="rtl"` being
present on `<html>` — via a Tailwind `rtl:` variant or a `[dir="rtl"]`
selector in CSS — without needing to read `i18n.language` itself.

`RTL_LANGUAGES` in `src/i18n/index.js` is the single source of truth for
which language codes are right-to-left; add a language there (and to
`SUPPORTED_LANGUAGES`) to have the whole app treat it as RTL.

Only the five migrated surfaces have been checked/adjusted for RTL
correctness. Migrating a new page may require adding its own `rtl:`
utility classes for anything that assumes a fixed left-to-right layout
(icon position, absolute offsets, asymmetric margins) — grep the
migrated pages for `rtl:` as worked examples.
