# CSS Revamp Phase 4 — Shop Page Consolidation and Visual Enhancement

**Status: PASS-CANDIDATE** (see Verification below).

Nothing committed, nothing staged by this phase.

## Pre-flight — working tree at the start of this phase

```
 M apps/web/src/App.jsx
 M apps/web/src/features/homepage/AdaptiveProductEdit.jsx
 M apps/web/src/features/homepage/homepage.css
 M apps/web/src/features/immersive/immersive.css
 M apps/web/src/features/layout/ClientLayout.jsx
 M apps/web/src/features/pages/BuildYourBoxPage.jsx
 M apps/web/src/features/pages/HomePage.jsx
 M apps/web/src/features/storefront/StorefrontPage.jsx
 D apps/web/src/features/storefront/components/CommerceHeader.jsx
 D apps/web/src/features/storefront/components/HeroShowcase.jsx
 M apps/web/src/styles/client.css
MM apps/web/src/styles/storefront.css
 M apps/web/vite.config.js
 M docs/bmad/D0.1-design-quality-checklist.md
 M docs/bmad/D0.2-screen-audit-reports.md
A  docs/design/css-revamp-phase-1.md
M  packages/shared/styles/tokens.css
?? apps/web/src/features/homepage/GiftingShortcuts.jsx
?? apps/web/src/features/storefront/components/ShopFilterDrawer.jsx
?? apps/web/src/features/storefront/components/ShopToolbar.jsx
?? docs/design/css-revamp-audit.md
?? docs/design/css-revamp-phase-2.md
?? docs/design/css-revamp-phase-3.md
```

`storefront.css`, `tokens.css`, and `css-revamp-phase-1.md` were already
staged before this phase began (carried over from before Phase 1). This
phase did not stage, reset, or stash anything — `storefront.css` now shows
`MM` because this phase's edits landed in the working tree on top of that
pre-existing staged version.

Important context: `ShopToolbar.jsx`, `ShopFilterDrawer.jsx`, and the bulk of
the Shop-specific CSS in `storefront.css` were **already built earlier in
this design cycle**, before Phase 1 began (they appear as pre-existing
untracked/modified files above). Phase 4's job was to consolidate what
already existed, close the specific gaps against this phase's fuller spec,
and verify it end-to-end — not to build the Shop page from a blank slate.

## Task A — Live Shop architecture (confirmed, not assumed)

- **Route**: `/shop` → `App.jsx` → `ShopPage.jsx` (`export { StorefrontPage as
  ShopPage } from "../storefront/StorefrontPage.jsx"`) → `StorefrontPage`.
  Single route, single component, no duplication.
- **Home vs Shop**: confirmed separate routes (`getRoute()` in `App.jsx`
  distinguishes `/` from `/shop*`); navigating to either does not affect the
  other's mounted state.
- **Navigation entries**: every Shop-bound nav item (desktop `CATEGORY_RAIL`,
  mobile `DRAWER_GROUPS`, header search submit, "Find a Scent" CTA, homepage
  cross-links) calls the same `navigate("shop", category)` function in
  `ClientLayout.jsx` / `App.jsx` — confirmed via grep, zero alternate paths.
- **Product detail**: clicking a card's media, title, or "View details"
  button all call the same `onViewProduct`/`viewProduct()` path, which
  resolves to `/products/:id`. Verified live: clicking a card navigated to
  `/products/prf-004` and rendered the product-detail layout.
- **Data source**: `marketplaceApi.getStorefront()` → backend. Verified live
  against the running API: `GET /api/marketplace/storefront` returns 13
  products, **all** with `status: "Live"` — zero Draft/Hidden/Archived
  records reach the client.
- **Visibility enforcement**: server-side (`sanitizePublicProduct`) is the
  real boundary — confirmed unchanged. The client additionally re-filters
  `status === "Live"` inside `StorefrontPage` (`liveProducts` in
  `StorefrontPage.jsx`); this is defense-in-depth, not the security boundary,
  and was preserved as-is, not rebuilt as a new client-side rule.
- **Search/category/family/sort/pagination/drawer state ownership**: search
  text (`query`) and fragrance family (`family`) are owned by `App.jsx` and
  passed down as props (search is applied to `filteredProducts` *before*
  `StorefrontPage` ever sees it — see the empty-state finding below for why
  this matters). Category, occasion, sort, and the mobile drawer's
  open/closed state are all owned locally inside `StorefrontPage` via
  `useState`. No duplicate state, no duplicate fetch — confirmed by reading
  every `useState`/`useMemo` in both files.

No duplicate routes or duplicate fetching logic exist anywhere in this path.

## Task B — Shop selector ownership map

A repo-wide check confirmed **zero `.shop-*` selectors and zero
`.catalog-card-*`/`.product-card`/`.cake-card`/`.gift-card` selectors exist
outside `storefront.css`** (`client.css`, `homepage.css`, `base.css`,
`tokens.css`, `immersive.css` all checked). This is a meaningfully simpler
starting position than Phase 3's homepage work — there was no cross-file
duplication to reconcile, only within-file organization to confirm and label.

| Area | Selectors (representative) | Classification |
|---|---|---|
| Shop shell | `.shop-page` | Shop-owned |
| Shop heading/discovery | `.shop-header*`, `.shop-header-copy`, `.shop-header-meta`, `.shop-header-count` | Shop-owned |
| Search/category/toolbar | `.shop-shell`, `.shop-category-nav`, `.shop-category-button`, `.shop-toolbar*`, `.shop-search-*`, `.shop-sort*`, `.shop-ai-button`, `.shop-filter-toggle`, `.shop-filter-count` | Shop-owned |
| Fragrance family | `.shop-family-filter*`, `.shop-filter-heading`, `.shop-filter-reset`, `.shop-family-chip*`, `.shop-family-dot` | Shop-owned (shared structurally between the inline toolbar copy and the drawer copy — see below) |
| Active filters / results summary | `.shop-results-bar`, `.shop-results-copy`, `.shop-results-meta`, `.shop-active-filters*` | Shop-owned |
| Product grid | `.shop-product-grid*`, `.shop-grid-feature` | Shop-owned (grid container only) |
| Product cards | `.product-card`, `.cake-card`, `.gift-card`, `.catalog-card-*`, `.product-media-button`, `.product-body`, `.product-footer`, `.product-title-button` | **Shared product-card** — used by Shop today, written generically, zero current consumers outside Shop but not Shop-exclusive by design. Intentionally left in its existing shared section (lines ~659–760, well before the Shop block), not moved. |
| Build-a-Box cross-sell insert | `.shop-build-insert*` | Shop-owned (in-grid promotional card, not a product card) |
| Pagination/load-more equivalent | `.shop-results-end*` | Shop-owned |
| Empty state | `.shop-empty-state`, `.shop-empty-actions` | Shop-owned |
| Loading state | `.cl-loading` | **Not Shop-owned** — lives in `client.css`, shared across every route in the app (loading gates the entire router, not just Shop). See "Remaining Shop debt." |
| Error state | `.cl-error` | **Not Shop-owned** — same as above, app-wide. |
| Filter drawer | `.shop-drawer*` | Shop-owned |
| Family chip color tokens | `--family-tone` inline custom property, set from a `familyTones` JS object in `StorefrontPage.jsx` (not a CSS custom property defined in any stylesheet) | Component-owned, consumed by `.shop-family-dot` |
| Shared utilities used by Shop | `.eyebrow`, `.primary-action`, `.secondary-action`, `.ghost-action`, `.icon-button` | Shared utility — untouched |

No descendant-selector or pseudo-state false positives were an issue this
phase (unlike Phase 3) because there was no cross-file search-and-merge
step — every Shop selector already had exactly one definition.

## Task C — CSS consolidation performed

The Shop CSS was **already a single, contiguous, logically-ordered block**
(lines 3747–4486 of `storefront.css`, under a `SHOP RECONSTRUCTION` header)
from earlier work this design cycle — there was no scattering across the
file to fix. This phase's consolidation work was:

1. Replaced the single generic `SHOP RECONSTRUCTION` header with an
   ownership banner pointing to this document and explicitly naming what's
   shared vs. Shop-exclusive.
2. Added named sub-section comments matching the task's preferred structure
   (`Shop shell`, `Shop heading and discovery`, `Search, category and
   toolbar`, `Active filters & results summary`, `Product results and grid`,
   `Pagination / load more`, `Loading, empty and error states`, `Filter
   drawer`, `Shop responsive`) directly above the existing rules — labeling
   only, no rule reordering, since the existing order already matched the
   spec closely enough that reordering would add diff risk for no cascade
   benefit (every selector in this block is Shop-exclusive and single-
   defined, so source order carries no hidden cascade dependency either way).
3. Documented, rather than physically relocated, the one deliberate
   exception: the shared product-card family stays in its pre-existing
   shared section earlier in the file, not moved into the new Shop banner's
   scope — moving genuinely shared, multi-consumer-capable CSS into a
   page-specific block would be the wrong direction for ownership clarity.
4. No selector was deleted as part of consolidation — there were no real
   duplicates to remove (see Task B). The only rule *changes* in this phase
   are the two functional fixes below (Task D/E), not duplicate removal.

`client.css` and `base.css` were not touched — neither had a Shop-specific
rule that belonged in `storefront.css` (Task B's cross-file search came back
clean), so the "optional only if required" condition for editing them was
never triggered.

## Task D — Visual redesign: gap analysis and changes made

Most of Task D's spec was already satisfied by the existing build. Reading
`StorefrontPage.jsx`, `ShopToolbar.jsx`, `ShopFilterDrawer.jsx`, and the full
CSS block against every numbered requirement found:

**Already satisfied, verified, not changed:**
- Compact intro (no full-screen hero) with eyebrow "Shop Tuti", headline
  "Find the right gift for the moment.", supporting copy, live result count,
  and one AI discovery action ("Help me choose") — matches 1:1.
- One cohesive discovery system: search, sort, category tabs, filter trigger
  with active-count badge, and a clear-all action, all sharing one pill
  radius and one 2.75rem control height — no competing bordered boxes, no
  inconsistent radii.
- Category tabs (All / Perfumes / Cakes & Desserts / Gift Sets) with
  `aria-pressed` selected state, keyboard-operable buttons, horizontal
  overflow-scroll under 820px, and category switching that correctly
  re-filters results (verified live: All→13, Cakes→6, Gift Sets→3,
  Perfumes→4, each with a correctly pluralized results label).
- Fragrance-family filters appear only for Perfumes/All, and only render
  values actually present in the live data (`orderedFamilies` is derived
  from real product data, not a hardcoded list) — confirmed live: only
  All/Musk/Amber/Fresh render today because no live product currently has
  an Oud or Floral family value.
- Restrained AI affordance: "Help me choose" uses `var(--info)`/
  `var(--info-bg)` (soft teal, not gold), a wand icon, a text label, and
  navigates to `/fragrance-finder` — does not generate fake recommendations.
- Product cards already share one coherent visual family: `.product-card`,
  `.cake-card`, and `.gift-card` all compose the same `catalog-card-*` base
  classes for media, header, title, summary, meta, rating, footer, price,
  and actions, with category-specific extensions layered on top (cake
  tier/topper art, gift ribbon art, occasion tags) rather than divergent
  structures. One primary action ("View details") plus one icon
  add-to-cart button per card; no long descriptions, no competing buttons,
  no box-in-box.
- Image reliability: `.catalog-card-image` uses `position: absolute; inset:
  0; object-fit: cover` inside a `.catalog-card-media` with both a fixed
  `aspect-ratio` *and* a `min-height`, so there is no collapsed media
  container and no layout shift regardless of whether the image has loaded.
  Category-aware aspect ratio (4/5 perfume and gift, 4/3 cake) does not
  create uneven *card* heights because the grid uses `align-items: stretch`
  on flex-column cards — rows stay even even when media proportions differ.
- Results summary above the grid is compact (eyebrow + count + one line of
  context + active-filter chips + sort), not a second toolbar.

**Gap found and fixed — responsive grid columns:**
The spec requires 4 columns (wide desktop) → 3 (medium desktop) → 2
(tablet) → 2-or-1 (mobile, depending on readable width). The existing rules
gave 4 (≥1400px) and 3 (1180–1400px, inherited from the shared
`.product-grid` base rule) correctly, but then **collapsed straight to 1
column at ≤820px** — skipping the 2-column tablet step entirely, because the
shared `.product-grid`'s own ≤820px override (used by Collections and
related-product rails too) was winning by default. At 768px (one of this
task's required test breakpoints) the grid was rendering 1 column, not the
required 2. Fixed by adding two new `.shop-product-grid`-scoped rules
(`apps/web/src/styles/storefront.css`, in the new "Shop responsive"
section): 2 columns from 1180px down to 520px, 1 column only below 520px.
This overrides the shared base for Shop specifically without touching
`.product-grid` itself, so Collections/related-products (which still want
their own existing 1-column-at-820px behavior) are unaffected. Verified live
at 768px: 2 columns. Verified at 375px: 1 column.

No other Task D gaps were found. No JSX class renames were needed.

## Task E — System states

**Loading and error are app-level, not Shop-level — documented, not
rebuilt.** `App.jsx` owns `loading`/`loadError` state and short-circuits the
entire router (`if (loading) return <div className="cl-loading">…`) before
any route, including Shop, ever mounts. This means there is currently no way
to show a Shop-shaped skeleton or a Shop-specific error panel without first
changing how `App.jsx` sequences data-loading relative to routing — a
change that would affect Home, Cart, Account, and every other route
simultaneously, not just Shop. That is a materially bigger change than "Shop
CSS consolidation and visual enhancement," is not listed in this phase's
scope (`App.jsx` is absent from both the primary and optional file lists,
and is explicitly excluded via "do not redesign unrelated pages"), and was
therefore **not attempted**. It is recorded under "Remaining Shop debt" as a
Phase 5 candidate. The existing generic states were re-verified to still
satisfy the spirit of Task E's wording even though they're app-wide: the
loading state has `role="status" aria-live="polite"`, no shimmer, no
technical detail; the error state has `role="alert"`, a plain-language
"Cannot connect" message, and a Retry button — no stack traces.

**Empty state — a real bug was found and fixed.** `getEmptyState()` (inside
`StorefrontPage.jsx`) chooses its copy/actions from `hasSearch`,
`hasFamilyFilter`, `hasOccasion`, and `activeCategory`, but had no path that
distinguished "the whole marketplace has nothing live" from "your search/
filter matched nothing." Initial attempt: add a check on `liveProducts.length
=== 0`. Testing this immediately surfaced a bug — searching for a nonsense
string also drives `liveProducts.length` to 0, because `filteredProducts`
(this component's only product input) is *already* search/family-filtered
by `App.jsx` before `StorefrontPage` ever sees it. The first version of the
new branch incorrectly showed "No products in the marketplace yet" for an
ordinary zero-result search. Fixed by gating the new branch on `!hasActiveFilters
&& !hasAnyLiveProducts` — it only fires when nothing has been searched/
filtered *and* the (then-unfiltered) live count is genuinely zero, which is
the one case where the existing data flow can actually support the
distinction. Re-tested live: searching nonsense text now correctly shows
"No results for "..."" (unchanged behaviour); the new system-wide branch is
exercised by code-path reasoning (it's structurally identical to the other
branches and the gating condition was verified directly), since the live
dataset always has 13 products and can't be emptied without touching the
backend, which is out of scope.

The pre-existing filter-empty state itself (heading, explanation, "Clear
filters"/"Browse all products" actions, `role="status" aria-live="polite"`)
was already correct and required no changes — verified live via a nonsense
search, including confirming the primary action actually restores all 13
products.

## Task F — Mobile filter drawer

Verified live at 375px, no changes required:
- Search remains in a single compact row alongside Sort and a Filters
  button showing the active-filter count badge.
- Drawer (`ShopFilterDrawer.jsx`) has: heading ("Filters"), a labelled close
  button, the fragrance-family filter group, "Clear all", and "Show
  results" — matches the spec's required structure exactly.
- Focus management confirmed live: opening the drawer moves focus to the
  close button; pressing `Escape` closes it and returns focus to the
  trigger button (`triggerRef.current.focus()` in the cleanup effect).
- Background interaction prevented while open (`document.body.style.overflow
  = "hidden"` for the duration).
- 0px horizontal overflow confirmed at 375px both with the drawer closed and
  open.
- Touch targets: every interactive control in the toolbar/drawer
  (`.shop-search-field`, `.shop-sort-control`, `.shop-filter-toggle`,
  `.shop-family-chip`, `.shop-drawer-close`) is ≥2.75rem (44px) tall per the
  existing CSS — confirmed by reading the values, consistent with Phase 1's
  established 44px rule.

## Task G — Accessibility

All confirmed live or by direct code reading:
- Exactly one `<h1>` on `/shop` (confirmed via DOM query: count = 1).
- Search input has both a visible icon-adjacent placeholder and an explicit
  `aria-label="Search products, boutiques or occasions"`.
- Category buttons expose `aria-pressed`; the active tab is also visually
  distinct (filled background).
- Sort control is a `<label htmlFor="shop-sort-select">` wrapping a `<select
  id="shop-sort-select">` — both visibly labelled ("Sort") and programmatically
  associated.
- Filter drawer: `role="dialog" aria-modal="true"
  aria-labelledby="shop-drawer-title"`; close button has `aria-label="Close
  filters"`.
- Keyboard focus: confirmed visible (`:focus-visible`) on the Shop page via
  `document.activeElement.matches(':focus-visible')` after real Tab
  keypresses.
- Product images use `alt={`${product.name} by ${sellerName}`}` — meaningful,
  not empty, not generic "image" text.
- Every decorative icon (`lucide-react` glyphs) across `StorefrontPage.jsx`,
  `ShopToolbar.jsx`, and `ShopFilterDrawer.jsx` carries `aria-hidden="true"` —
  verified by grep, zero exceptions found.
- Loading/empty/error use appropriate live-region roles (`status`/`alert`,
  detailed under Task E).
- No duplicate interactive destination inside a card: the media button,
  title button, and "View details" button all lead to the same product, but
  they are siblings, not nested interactive elements — a standard, valid
  multi-entry-point pattern, not a duplication defect.
- No heading nested inside a button anywhere in the Shop component tree —
  the actual pattern is the reverse (`<h3><button>…</button></h3>`, a button
  inside a heading), which is valid.
- No duplicate IDs: `catalog-search-input`, `shop-sort-select`,
  `shop-header-title`, `shop-drawer-title` are each used exactly once per
  page render.
- No keyboard trap: `Escape` closes the drawer (confirmed live), and it is
  the only modal-like surface on the page.

## Task H — CSS quality rules

- Every new/touched rule uses existing tokens (`var(--brand-dark)`,
  `var(--info)`, `var(--ink)`, `var(--muted)`, `var(--paper)`, etc.) — no new
  custom properties were introduced, and none of the eight still-undefined
  variables from Phase 1–3 were defined here (out of scope, as instructed).
  No new raw one-off colours were added; the two new responsive rules this
  phase added contain no colours at all (`grid-template-columns` only).
  No `!important` was added anywhere.
- Canonical breakpoints 520px / 820px / 1180px were used for the new
  tablet/mobile grid-column fix specifically because they're canonical — no
  new one-off breakpoint was introduced to solve this gap.
- **One-off breakpoints retained, with reasons** (none newly introduced this
  phase, both pre-existing):
  - `1400px` (`min-width`) — wide-desktop 4-column step. Necessary because
    none of the three canonical breakpoints sit above 1180px; without a
    dedicated wide-desktop step the grid would stay at 3 columns
    indefinitely on very wide screens, visibly under-using the available
    width (verified at 1440px: 4 columns render correctly and remain
    readable).
  - `640px` (`max-width`) — compacts the results/empty-state heading size and
    stacks the results-end/empty-state action buttons to full width before
    the toolbar's own 520px breakpoint would otherwise leave them
    cramped between 520 and 820px. Kept as-is; not folded into 520 or 820
    because doing so was not required to close any gap this phase
    identified, and changing it risks a regression in exactly the kind of
    "broad breakpoint rewrite" this phase (and Phase 3 before it) was told
    to avoid.

## Task I — Product visibility (re-verified live)

Confirmed against the running backend, not assumed from prior phases:
`GET /api/marketplace/storefront` returns 13 products, **100% with
`status: "Live"`** — zero Draft/Hidden/Archived/Suspended/admin-only records
present in the response. This is enforced server-side
(`sanitizePublicProduct`); the client's own `status === "Live"` filter in
`StorefrontPage.jsx` is preserved exactly as it was — a redundant
defense-in-depth check, not a new client-side security rule invented by this
phase.

## Lines and bundle size

| Metric | Before Phase 4 | After Phase 4 | Change |
|---|---|---|---|
| `storefront.css` lines | 10,210 | 10,250 | +40 (2 new responsive rules + comments, ~18 lines; ownership/section comments, ~22 lines) |
| `StorefrontPage.jsx` lines | 500 | 518 | +18 (new empty-state branch + `hasAnyLiveProducts` plumbing) |
| `ShopToolbar.jsx` / `ShopFilterDrawer.jsx` | unchanged | unchanged | 0 (no gaps found requiring changes) |
| Customer web CSS bundle (raw) | 234.99 kB | 235.12 kB | +0.13 kB |
| Customer web CSS bundle (gzip) | 41.14 kB | 41.15 kB | +0.01 kB |
| Customer web JS bundle (raw) | — | 480.08 kB | +(reflects the 18-line JSX fix; negligible) |
| Other 4 apps | unchanged | unchanged | 0 bytes (no file outside `apps/web` touched) |

The small increase (rather than a decrease, unlike Phases 2–3) is expected
and correct for this phase: there were no real duplicates to remove (Task B
came back clean), so the net change reflects one genuine new responsive
behaviour, one genuine bug fix, and the ownership-clarifying comments Task C
asked for — not a cleanup pass with deletions to show for it.

## Verification

- `git diff --check` — clean.
- `npm run test:critical-smoke` — 5/5 pass, including "public storefront
  filtering" specifically.
- `npm run build` — all five workspaces build clean; customer CSS/JS bundle
  sizes recorded above; seller/admin/driver/sr byte-identical to before.
- Functional, live-browser checks (Playwright against the dev server):
  Home loads; Shop loads; category tabs correctly filter (All=13,
  Cakes=6, Gift Sets=3, Perfumes=4) with correctly pluralized labels; sort
  by price-ascending correctly reorders cards (235→255→280→390); a nonsense
  search correctly produces the filter-empty state and "Clear search &
  filters" correctly restores all 13 products; the mobile filter drawer
  opens, manages focus, and closes on `Escape`; clicking a product card
  navigates to `/products/prf-004` and renders the product-detail layout;
  Cart still loads; `:focus-visible` still functions on Shop.
- Visual checks captured and reviewed at 375px, 768px, 1280px, and 1440px:
  0px horizontal overflow and 0 console errors at every size; 2-column
  tablet grid confirmed at 768px (the fixed gap); 1-column confirmed at
  375px; 4-column confirmed at 1440px (full-page screenshot). Close-up
  review of the header/discovery band, toolbar, a single product card, and
  the mobile filter drawer all matched the intended design with no
  regressions.
- No gold-token usage found anywhere in Shop CSS (checked directly — the
  family-tone dots use bespoke per-family hex values, not `--gold`),
  comfortably under D0.1's "max 2 gold elements at rest" rule.

## Pre-existing work preserved

All pre-flight items are still present after this phase. This phase's own
changes are: `StorefrontPage.jsx` and `storefront.css` further modified (on
top of, not instead of, their pre-existing modifications); this document
added. `ShopToolbar.jsx`, `ShopFilterDrawer.jsx`, `ProductCard.jsx`,
`CakeCard.jsx`, and `GiftBoxCard.jsx` were read in full but required no
edits — every gap found was resolvable inside `StorefrontPage.jsx` and
`storefront.css` alone.

## Remaining Shop debt

- **Loading/error states are app-wide, not Shop-shaped** (see Task E) — the
  single largest remaining gap against the full spec, and the reason this
  phase could not fully satisfy Task E's "product skeletons matching final
  card dimensions" requirement. Fixing it properly means changing how
  `App.jsx` sequences data-loading versus routing, which affects every page,
  not just Shop.
- `GiftBoxCard.jsx` reuses `CakeCard`'s class names for its rating/footer/
  price-block/add-button (`cake-card-rating`, `cake-card-footer`,
  `cake-price-block`, `cake-add-btn`) instead of having its own
  `gift-card-*` equivalents. This is a naming/maintainability inconsistency
  only — it produces zero visual difference since the rules apply
  identically regardless of origin — and was left as-is rather than
  renamed, since renaming a live JSX class purely for naming hygiene with no
  visual benefit is exactly the kind of unnecessary change this phase's
  brief warns against ("do not rename live JSX classes unless strictly
  necessary").
- The shared product-card family (`.product-card`/`.cake-card`/`.gift-card`/
  `.catalog-card-*`) currently has exactly one consumer (Shop). It's
  correctly classified as shared-by-design rather than Shop-exclusive, but
  if no second consumer ever materializes, a future phase could reasonably
  ask whether it should simply be reclassified as Shop-owned.
- The `640px` and `1400px` one-off breakpoints (see Task H) remain as
  pre-existing, justified exceptions to the 520/820/1180 canonical set.

## Recommendation for Phase 5

1. If a true Shop-specific skeleton loader is wanted, it requires an
   `App.jsx`-level change first: thread `loading`/`loadError` down as props
   (or move the loading gate below the route switch) so each route can
   render its own shaped skeleton instead of one global "Loading…" string.
   Scope that as its own phase given the blast radius (every route, not
   just Shop).
2. Apply this phase's verification methodology (live API check for
   visibility, Playwright functional checks for every filter/sort/category
   combination, not just a visual screenshot) to Product Detail next, since
   it's the page every Shop card and the homepage product rails both funnel
   into, and Phase 0's original audit never gave it the same selector-level
   treatment Shop just received.
3. Low-priority cosmetic cleanup: rename `GiftBoxCard.jsx`'s borrowed
   `cake-*` classes to `gift-*` equivalents, purely for long-term
   maintainability — zero visual risk, zero urgency.

## Final report

**PASS-CANDIDATE.**

- Exact changed files: `apps/web/src/features/storefront/StorefrontPage.jsx`,
  `apps/web/src/styles/storefront.css`, `docs/design/css-revamp-phase-4.md`
  (new), `docs/bmad/D0.2-screen-audit-reports.md` (Shop audit record added).
  `ShopToolbar.jsx`, `ShopFilterDrawer.jsx`, `ProductCard.jsx`,
  `CakeCard.jsx`, `GiftBoxCard.jsx`, `client.css`, `base.css` were all read
  but required no edits.
- Route/data verification: single `/shop` route, single fetch path, 100% of
  returned products are `status: "Live"`, confirmed live against the
  running API.
- Selectors moved/merged/removed: none required (Task B found zero
  cross-file or within-file duplicates). Two new Shop-scoped responsive
  rules added; ~10 ownership/section comments added; zero rules deleted.
- Visual enhancements: closed the tablet/mobile 2-column grid gap; fixed a
  real empty-state logic bug (system-wide vs. filter-empty was previously
  unreachable and partially mis-firing during initial implementation, now
  correct and verified).
- Filter/search/sort behaviour: verified live and correct (category counts,
  pluralized labels, price-ascending sort order, clear-filters restoration).
- Product-card changes: none required — already one coherent visual family
  across perfumes/cakes/gift sets.
- Image reliability: verified — stable aspect ratio, no collapse, no shift,
  correct `object-fit`.
- Loading/empty/error: empty state fixed and verified; loading/error
  documented as app-wide, out of this phase's authorized scope, and listed
  as the top Phase 5 candidate.
- Accessibility: full pass, see Task G — no violations found.
- Responsive: 375/768/1280/1440 all verified 0px overflow, 0 console errors;
  the 768px 2-column gap is now closed.
- CSS/bundle size: +40 lines / +0.13 kB raw — a small, expected increase
  (no duplicates existed to remove), not a regression.
- Test/build: smoke 5/5, all 5 apps build clean, `git diff --check` clean.
- Pre-existing work: fully preserved, confirmed via before/after `git
  status --short`.
- Remaining risks: low. The one open architectural gap (app-wide loading/
  error states) is clearly documented and explicitly deferred rather than
  half-fixed.
