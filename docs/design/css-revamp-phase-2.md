# CSS Revamp Phase 2 — Verified Orphan Removal

**Status:** Deletion-only (plus this documentation). No redesign, no class
renames, no route changes, no backend/test/package/lockfile changes. Nothing
committed.

## Pre-flight — working tree at the start of this phase

```
 M apps/web/src/App.jsx
 M apps/web/src/features/homepage/AdaptiveProductEdit.jsx
 M apps/web/src/features/homepage/homepage.css
 M apps/web/src/features/layout/ClientLayout.jsx
 M apps/web/src/features/pages/BuildYourBoxPage.jsx
 M apps/web/src/features/pages/HomePage.jsx
 M apps/web/src/features/storefront/StorefrontPage.jsx
 M apps/web/src/styles/client.css
M  apps/web/src/styles/storefront.css
 M apps/web/vite.config.js
 M docs/bmad/D0.1-design-quality-checklist.md
 M docs/bmad/D0.2-screen-audit-reports.md
A  docs/design/css-revamp-phase-1.md
M  packages/shared/styles/tokens.css
?? apps/web/src/features/homepage/GiftingShortcuts.jsx
?? apps/web/src/features/storefront/components/ShopFilterDrawer.jsx
?? apps/web/src/features/storefront/components/ShopToolbar.jsx
?? docs/design/css-revamp-audit.md
```

Worth noting explicitly: `apps/web/src/styles/storefront.css`,
`packages/shared/styles/tokens.css`, and `docs/design/css-revamp-phase-1.md`
were already **staged** (index column `M`/`A`) when this phase began —
someone had run `git add` on Phase 1's output before this phase started. This
phase did not run `git add`, `git reset`, or any other index-modifying
command at any point, so that staged state was left exactly as found; this
phase's edits to `storefront.css` landed in the working tree on top of the
already-staged version, which is why it now shows as `MM` (staged-and-also-
modified) — see "pre-existing work preserved" below for confirmation nothing
was lost.

## Group A — Orphaned components (deleted)

**Verification performed** (repo-wide, not just `apps/web`):
- Static imports: `grep -rln "CommerceHeader\|HeroShowcase" --include="*.jsx" --include="*.js" --include="*.ts" --include="*.tsx" .` → only the components' own files matched.
- Dynamic imports: `grep -rn "import(.*CommerceHeader\|import(.*HeroShowcase" ...` → zero matches.
- Barrel exports: checked for an `index.js`/`index.jsx` under `apps/web/src/features/storefront/components/` → none exists.
- String-based registries: `grep -rn "\"CommerceHeader\"\|'CommerceHeader'\|\"HeroShowcase\"\|'HeroShowcase'" --include="*.jsx" --include="*.js" --include="*.json" .` → zero matches.
- Tests: `grep -rln "CommerceHeader\|HeroShowcase" --include="*.test.js" --include="*.test.jsx" .` → zero matches.
- Route configuration: checked `apps/web/src/App.jsx` directly → neither name appears.
- Documentation implying active use: the only docs mentioning either name are `docs/design/css-revamp-audit.md` and `css-revamp-phase-1.md`, both of which document them as dead, not active.
- Wildcard imports of the components directory (`from "../components"` / `from "./components"`) → zero matches, so no barrel-style re-export could be hiding a reference either.

**Deleted:**
- `apps/web/src/features/storefront/components/CommerceHeader.jsx` (57 lines)
- `apps/web/src/features/storefront/components/HeroShowcase.jsx` (54 lines)

## Group B — CSS owned exclusively by the deleted components

Exact classes read directly from the two files before deletion:
- `CommerceHeader.jsx`: `.commerce-header`, `.commerce-menu`, `.delivery-chip`, `.commerce-search`, `.commerce-account`
- `HeroShowcase.jsx`: `.hero-band`, `.premium-hero`, `.hero-content`, `.hero-stats`, `.hero-actions`, `.hero-proof` (plus the shared `.eyebrow`/`.primary-action`/`.secondary-action`, explicitly not touched)

For every one of those, after deleting the two components: `grep -rlE "[\"' ]<class>[\"' ]"` across `apps/web/src`, `packages/shared`, and all four other apps' `src` returned zero matches (re-run with proper word-boundary matching after an initial substring false-positive on `hero-stats`/`hero-actions` — see "methodology note" below).

**Important findings during verification, not assumed from the audit:**
- `.commerce-cart` is *not* actually used by `CommerceHeader.jsx` (it only uses `.commerce-menu`), but is comma-grouped with `.commerce-menu` in one CSS rule. Independently verified zero consumers anywhere, so the whole rule was removed — this one is really a Group C deletion riding inside a Group B rule, not Group B itself.
- `.nav-button` (named in the brief's "expected families") is **not** used by either deleted component at all. It lives in its own standalone rules elsewhere in `storefront.css`, *and* is one of six names in a shared combo selector (`.nav-button, .filter-tab, .icon-button, .primary-action, .secondary-action, .ghost-action {...}`) together with explicitly-protected shared action classes. The combo rule was **left completely untouched**; only `.nav-button`'s own standalone rules (base + `.active`/`:hover` + two responsive overrides) were removed, since those don't touch any protected class.
- `.delivery-chip` is *also* referenced inside two large, unrelated shared "chip" utility rules further down `storefront.css`, comma-grouped with clearly-live classes (`.cake-meta-chip`, `.gift-meta-chip`, `.footer-payment-chip`, `.notification-badge`, etc.). Those two rules were **left untouched** — editing them would mean restructuring a live, shared rule, which this phase forbids. Only the `.delivery-chip`-with-`.commerce-account` rules (which have no live co-members) were removed.
- `.hero-content` and `.hero-actions` are each comma-grouped with the **live** `.page-title` (used by `packages/shared/components/PageTitle.jsx`) and the **live** `.product-footer` (used by `ProductCard.jsx`) respectively, in two separate rules. Those two compound rules were **left completely untouched**. Only the standalone `.hero-content`/`.hero-actions` rules that don't mix with either live class were removed.

**Methodology note:** the audit's automated pass undercounted `.ghost-action` usage by 5× by missing multi-class `className` strings. To avoid the mirror-image mistake in this phase, every "zero consumers" check here used `grep -E "[\"' ]<class>[\"' ]"` (matches the class whether it's alone or inside a multi-class string) rather than an exact full-string match — and an early pass that used plain substring matching produced its own false positive (`hero-stats`/`hero-actions` appeared to match `sitemap-hero-actions`, a different class entirely) before being corrected to use word-boundary patterns.

## Group C — Independently verified dead customer-only selectors

Each family below was fresh-verified with `grep -rlE "[\"' ]<class>[\"' ]" apps/web/src packages/shared --include="*.jsx"` (and, for names that sound seller/admin-shaped, also checked against `apps/seller/src` and `apps/admin/src`) immediately before deletion — not taken from the Phase 0 audit's word.

| Family | Result | Action |
|---|---|---|
| `.admin-shell`, `.admin-sidebar`, `.admin-brand` (+`small`), `.admin-nav`, `.admin-nav-button`, `.admin-back-button`, `.admin-main` (+ `.admin-main .workspace`), `.admin-topbar` (+ `h1`/`-actions`), `.admin-user` | 0 consumers, every base rule and matching responsive override fresh-verified | Removed in full (base block + two responsive-override blocks) |
| `.analytics-risk-list`, `.analytics-risk-row`, `.analytics-inventory` — **and** the tightly-coupled `.risk-bar`/`.risk-bar-wrap`/`.risk-bar.low/medium/high`/`.inventory-stat` (+ sub-rules), not separately named in the brief but exclusively used inside this same self-contained "Analytics" section | 0 consumers for every selector, including the unnamed ones | Removed the entire self-contained section |
| `.customer-management-grid`, `.customer-card`, `.customer-card-head` (+`h3`/`p`/`.risk` descendant), `.customer-avatar`, `.customer-kpi-row` (+`span`/`strong`), `.customer-contact` (+`span`), `.customer-note` — plus their compound-paired `.seller-customer-grid`/`.seller-customer-head`/`.seller-kpi-row` | 0 consumers for every name in this set, including the seller-prefixed pairs | Removed (base block + one responsive override) |
| Legacy catalog-page layout: `.catalog-page`, `.catalog-hero` (standalone def only), `.catalog-hero-stat`(+`strong`/`span`), `.catalog-shell` (standalone def only), `.catalog-shell-picture-first`, `.catalog-controls`(+`-row`+descendant `.search-field` override), `.catalog-results-head`(+`h2`/`p`), `.catalog-results-meta`(+`span`), `.catalog-browsing-summary`, `.catalog-browsing-label`, `.catalog-browsing-chips`(+ its own standalone `span` sub-rule), `.catalog-product-grid`, `.catalog-empty-state`(+`h3`/`p`), `.catalog-empty-actions`, `.catalog-supporting` | 0 consumers for every name | Removed everywhere these appear *without* live co-members (base section + 4 separate responsive-override locations) |
| Legacy category-\* showcase: `.category-tabs`, `.category-tab`(+`:hover`/`.active`), `.category-tab-count`, `.category-showcase`, `.category-card-link`(+`--feature`) | 0 consumers; confirmed the live equivalent is `CategoryShowcase.jsx`'s unrelated `.cat-*` naming | Removed (base section + 4 separate responsive-override locations) |
| Dead `cl-*` subset: `.cl-topbar-inner`, `.cl-brand-mark`, `.cl-brand-name`, `.cl-nav-btn`(+`:hover`/`.active`), `.cl-icon-btn`/`.cl-cart-btn`(+`:hover`), `.cl-cart-badge`, `.cl-sell-btn`(+`:hover`), `.cl-signin-btn`(+`:hover`), `.cl-user-btn`, `.cl-avatar` | 0 consumers for all 11; `.cl-bar1`, `.cl-account-chip`, `.cl-cart-chip`, `.cl-cart-label`, `.cl-dropdown-*`, `.cl-brand`, `.cl-nav`, `.cl-actions`, `.cl-user-wrap`, `.cl-logo-name` confirmed **live** and untouched | Removed in `client.css` (base block + 3 separate responsive-override lines; one rule was already flagged `/* Legacy rules kept for orphaned classes */` by a previous author and is now actually removed) |

### Deferred — not deleted, despite looking dead

- **`.checkout-steps` (base rule) and `.checkout-step-card`** (+ its `span`/`h2`/`p` sub-rules): fresh-verified 0 consumers for both, but `.checkout-step-card` is comma-grouped with the **live** `.checkout-summary-card` (`CartCheckoutPage.jsx`) in three separate sub-rules. This pair was not in the brief's named Group C list, and the entanglement with a live, business-critical checkout class made it the wrong place to extend scope. One simple, non-compound responsive one-liner for `.checkout-steps` *was* removed (verified safe in isolation); everything else in this pair was left untouched.
- **`.customer-tags` (+ `span`), `.management-priority-list`, `.management-priority-row` (+`strong`/`p`), `.priority-dot` (+ 3 modifiers), `.seller-health-row` (+`span`), `.seller-health-badge`** (+3 modifiers): adjacent to the deleted customer-management block, also fresh-verified 0 consumers, but not part of the named family — deliberately left untouched rather than extending the deletion boundary past what was authorized.
- **The two shared "chip" utility rules** that mention `.delivery-chip` and `.catalog-browsing-chips span` alongside `.cake-meta-chip`, `.gift-meta-chip`, `.footer-badge`, `.footer-payment-chip`, `.sv-occ-chip`, `.notification-badge`, `.promo-badge`, `.checkout-auth-helper` (all live) — left completely untouched, both names remain as dead weight inside an otherwise-live shared rule.
- **The `.nav-button, .filter-tab, .icon-button, .primary-action, .secondary-action, .ghost-action` combo selector** — left completely untouched; contains five protected/live classes.
- **`.hero-content h1, .page-title h1`** and **`.hero-content p, .page-title p`** — left completely untouched; `.page-title` is live.
- **`.hero-actions, .button-pair, .product-footer, .seller-central-bar`** — left completely untouched; `.product-footer` is live (`ProductCard.jsx`).
- **`.catalog-hero, .catalog-shell, .sitemap-hero, .checkout-layout`** (base rule, plus its `h1`/`p` compound sub-rules, plus two responsive-override copies further down the file that add `.account-orders-layout`/`.order-confirmation-panel` to the same list) — left completely untouched; `.sitemap-hero` (`sitemapPageShared.jsx`, shared by Legal/Journal/Gifting/etc.) and `.checkout-layout` (`CartCheckoutPage.jsx`) are both live. This was the highest-stakes deferral in this phase — deleting it would have broken the live cart/checkout page and every sitemap-style page.

If any of the deferred items above should be revisited, it would need its own
careful, rule-by-rule split of the live and dead comma-members first — exactly
the kind of "restructure live CSS" work this phase was told not to do.

## Lines and bundle bytes removed

| Metric | Before Phase 2 | After Phase 2 | Change |
|---|---|---|---|
| `storefront.css` line count | 11,008 (after Phase 1; 11,040 at Phase 0 baseline) | 10,244 | **−764 lines** |
| `client.css` line count | 2,576 (untouched by Phase 1) | 2,513 | **−63 lines** |
| Component JSX | — | — | **−111 lines** (2 files deleted) |
| **Total lines removed this phase** | | | **≈938** |
| Customer web built CSS (raw) | 250.76 kB | 235.61 kB | **−15.15 kB (−6.0%)** |
| Customer web built CSS (gzip) | 43.66 kB | 41.20 kB | **−2.46 kB (−5.6%)** |
| Customer web built JS | 479.80 kB | 479.80 kB | unchanged (the two deleted components were never bundled — consistent with being fully orphaned) |
| Seller / Admin / Driver / SR built CSS+JS | unchanged | unchanged | **0 bytes** (this phase never touched any file outside `apps/web`) |

## Verification

- `git diff --check` — clean.
- `npm run test:critical-smoke` — 5/5 pass.
- `npm run build` — all five workspaces build clean: `@tuti/web`, `@tuti/seller`, `@tuti/admin`, `@tuti/driver`, `@tuti/sr`.
- Confirmed zero remaining references to `CommerceHeader`/`HeroShowcase` anywhere in the repo post-deletion.
- Customer Home, Shop, and Cart/Checkout loaded in-browser (Playwright, dev server): 0 console errors, 0px horizontal overflow on all three.
- `:focus-visible` confirmed functional via `document.activeElement.matches(':focus-visible')` after tabbing through the header.
- Visually compared Home/Shop/Cart screenshots against Phase 1's — pixel-equivalent; the Cart/Checkout "Order summary" card (`.checkout-summary-card`) in particular renders correctly, confirming the surgical edits around that live class didn't collateral-damage it.
- Current `ClientLayout` header (`.cl-*` live classes) and the immersive homepage hero (`.is-*` classes, never touched this phase) are unchanged — neither was edited.

## Pre-existing working-tree changes preserved

All 12 previously-modified/staged files and 4 untracked items listed in the
pre-flight section are still present after this phase, with their prior
content intact. This phase's own edits are: `CommerceHeader.jsx` and
`HeroShowcase.jsx` deleted; `storefront.css` and `client.css` further
modified (on top of, not instead of, their pre-existing modifications); this
new document added.

## Known remaining legacy areas (not touched this phase)

- Every item listed under "Deferred — not deleted" above.
- Everything else Phase 0's audit flagged that isn't in this phase's
  authorized scope: cross-file duplicate selectors (`.finder-layout`,
  `.sitemap-card` family), the within-file duplicate pattern (`.home-page`,
  `.trust-closing`, etc. each defined 2–4×), the button-trio/icon-button
  radius/weight divergence documented in Phase 1, and the inconsistent
  media-query breakpoint sprawl. None of these are dead code — they're live,
  duplicated, or inconsistent, which is explicitly a Phase 3+/consolidation
  concern, not a deletion concern.

## Final report

**PASS-CANDIDATE.**

- Exact files deleted: `apps/web/src/features/storefront/components/CommerceHeader.jsx`, `apps/web/src/features/storefront/components/HeroShowcase.jsx`.
- Exact CSS selector families removed: see Group B and Group C tables above — full list of ~60 individual selectors across `storefront.css` and `client.css`.
- Lines/bytes removed: ≈938 lines total; customer CSS bundle −15.15 kB raw / −2.46 kB gzip; zero change to JS or to any other app.
- Verification evidence for every deletion family: documented per-family above, all fresh-verified at deletion time (not reused from the Phase 0 audit).
- Deferred uncertain selectors: documented in full above, with the specific live class that blocked each one.
- Test/build results: smoke tests 5/5 pass; all 5 apps build clean; `git diff --check` clean.
- Pre-existing working-tree changes: all preserved, confirmed via before/after `git status --short` comparison.
- Remaining risks: none identified for the deletions actually made. The deferred items remain as (harmless, pre-existing) dead weight rather than a risk.
