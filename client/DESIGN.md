# Design plan

**Subject:** a POS/ERP terminal used all day by cashiers, shopkeepers, and bookkeepers across dozens of industries in Pakistan. **Audience:** people who need to move fast, trust the numbers, and read a screen from across a counter. **Job:** make every transaction and every balance legible at a glance, not impress on a landing page.

## Ground it in the subject

The one artifact every one of these businesses already produces and trusts is the **printed receipt / paper ledger**. That's the design's material: dashed tear-lines, tabular columns of figures, a ledger-green "paid/settled" color instead of the default AI terracotta or neon-dark. The signature element: **every number in the app — amounts, quantities, invoice numbers, phone numbers — renders in a tabular monospace, right-aligned**, so columns actually line up the way they would on a real receipt or ledger sheet. Nothing else gets that treatment; it stays exclusive to numbers, which is what makes it mean something rather than decorate.

## Token system

**Color** — `paper #FAF9F6` (background, unbleached ledger paper, not stark white), `surface #FFFFFF` (cards), `ink #16201D` (warm near-black), `ink-muted #5B6864`, `rule #D8DED9` (dividers/tear-lines), `accent #0F6B5C` (ledger green — the one accent, used for primary actions and positive/settled states), `danger #A3352B` (returns/voids), `warning #9C6B0A` (pending/due).

**Type** — Display: **Fraunces**, used sparingly (page titles, empty states only) so it can carry real character without slowing down dense screens. Body: **Inter**, chosen for legibility at 12–13px in tables used all day, not novelty. Mono: **IBM Plex Mono** with tabular figures — the signature, exclusive to numbers.

**Layout** — Fixed sidebar (icon + label, sections grouped by workflow proximity: Sell / Stock / Money / People / Reports) + topbar with branch switcher. Content areas use a tight 8px grid, hairline `rule` borders instead of shadows for separation — closer to a printed form than a floating card. The POS screen specifically mirrors a real checkout counter: product grid on the left, a running ticket styled like a receipt (dashed perforation between items and totals) on the right.

**Signature** — the tabular-mono numeral treatment described above, plus the receipt-style dashed divider (`border-dashed border-rule`) used at exactly one structural point per screen: between line items and their total. Not decoration — it's the same visual break a real receipt uses before the total, so the eye already knows what it means.

## Self-check against generic defaults

- Not cream+terracotta (#F4F1EA/#D97757): swapped warm cream for ledger-green as the accent family; terracotta appears nowhere.
- Not dark+neon: paper is light by default (a shop counter in daylight, not a dashboard in a dark room).
- Not broadsheet/hairline-newspaper: closer, but the mono-numerals signature and the receipt tear-line are specific to *this* subject (transactions), not a generic editorial layout.
- Radius is small (3px) and rules are hairline — restrained, no soft SaaS bubble-card look, no unjustified motion.
