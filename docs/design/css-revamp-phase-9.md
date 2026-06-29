# CSS Revamp Phase 9 — Legal, Journal, Sitemap, and Content Pages Cleanup

**Status: PASS-CANDIDATE** (see Verification below).

Nothing committed, nothing staged by this phase.

## Pre-flight — working tree at the start of this phase

```
 M apps/web/src/App.jsx
 M apps/web/src/features/auth/AuthModal.jsx
 M apps/web/src/features/homepage/AdaptiveProductEdit.jsx
 M apps/web/src/features/homepage/homepage.css
 M apps/web/src/features/immersive/immersive.css
 M apps/web/src/features/layout/ClientLayout.jsx
 M apps/web/src/features/pages/BuildYourBoxPage.jsx
 M apps/web/src/features/pages/HomePage.jsx
 M apps/web/src/features/pages/LoginPage.jsx
 M apps/web/src/features/pages/ProductDetailPage.jsx
 M apps/web/src/features/pages/SupportTicketsPage.jsx
 M apps/web/src/features/pages/sitemap/AccountPage.jsx
 M apps/web/src/features/pages/sitemap/CartCheckoutPage.jsx
 M apps/web/src/features/pages/sitemap/OrderConfirmationPage.jsx
 M apps/web/src/features/pages/sitemap/ResetPasswordPage.jsx
 M apps/web/src/features/reviews/ReviewContributionPanel.jsx
 M apps/web/src/features/storefront/StorefrontPage.jsx
 D apps/web/src/features/storefront/components/CartPanel.jsx
 D apps/web/src/features/storefront/components/CommerceHeader.jsx
 D apps/web/src/features/storefront/components/HeroShowcase.jsx
 M apps/web/src/main.jsx
 M apps/web/src/styles/client.css
MM apps/web/src/styles/storefront.css
 M apps/web/vite.config.js
 M docs/bmad/D0.1-design-quality-checklist.md
 M docs/bmad/D0.2-screen-audit-reports.md
A  docs/design/css-revamp-phase-1.md
 M packages/shared/components/EmptyState.jsx
 M packages/shared/components/MetricCard.jsx
 M packages/shared/components/PanelHeader.jsx
 M packages/shared/store/wishlistStore.js
M  packages/shared/styles/tokens.css
?? apps/web/src/AppErrorBoundary.jsx
?? apps/web/src/features/homepage/GiftingShortcuts.jsx
?? apps/web/src/features/layout/RouteState.jsx
?? apps/web/src/features/storefront/components/ShopFilterDrawer.jsx
?? apps/web/src/features/storefront/components/ShopToolbar.jsx
?? docs/design/css-revamp-audit.md
?? docs/design/css-revamp-phase-2.md
?? docs/design/css-revamp-phase-3.md
?? docs/design/css-revamp-phase-4.md
?? docs/design/css-revamp-phase-5.md
?? docs/design/css-revamp-phase-6.md
?? docs/design/css-revamp-phase-7.md
?? docs/design/css-revamp-phase-8.md
```

Exactly Phase 8's end state. This phase touched zero files under
`packages/shared/` — Seller/Admin/Driver/SR are guaranteed byte-identical.

## Mandatory comment safety rule

Every CSS edit this phase was followed immediately by a balance check
(`(content.match(/\/\*/g)||[]).length === (content.match(/\*\//g)||[]).length`)
on both `storefront.css` and `client.css` before the next build. All passed
on the first attempt.

## Task A — Live content-page architecture (as found)

- **Routing**: all six routes resolve via `App.jsx`'s prefix-matching
  `getRoute()` (`/legal*` → `legal`, `/journal*` → `journal`, `/gifting*`
  → `gifting`, `/offers` → `offers`, `/customer-service*` →
  `customer-service`, `/contact*` → its own `contact` key, `/store-locator`
  → `store-locator`). `SitemapPages.jsx` is a pure barrel re-export
  (confirmed by reading it — 11 lines, no logic) — not a route aggregator
  or legacy wrapper, just an indirection layer; nothing imports through it
  for these six pages (everything imports the underlying files directly).
- **Shared components**: `LegalPage`, `JournalPage`, `GiftingPage`,
  `OffersPage`, `CustomerServicePage` all use `PageHero`
  (`sitemapPageShared.jsx`) for their header; `GiftingPage`,
  `OffersPage`, `CustomerServicePage` also use `FeatureGrid`.
  `StoreLocatorPage` uses only `PageHero`. `sitemapPageShared.jsx` itself
  is **not** content-page-exclusive — most of its exports
  (`ItemFacts`/`OrderStatusTimeline`/`compactOrderItem`/etc.) are
  checkout/order helpers shared with `CartCheckoutPage`/`AccountPage`/
  `OrderConfirmationPage`. Nothing in it was modified this phase (it was
  only ever imported from, not edited), so those three pages are
  unaffected by this phase's work.
- **Obsolete components**: none of the six pages route through anything
  superseded — confirmed each imports its own file directly.
- **Browser refresh**: confirmed working for all six base routes before
  this phase; Legal's existing `/legal/:slug` detail view also already
  worked correctly on a direct refresh (it reads
  `window.location.pathname` itself) — but **see the critical finding
  below**, refresh was the *only* way it worked.
- **Route-state system (Phase 8) usage**: none of the six pages used it
  before this phase. Now: Legal's not-found branch and the new Journal
  not-found branch both use `RouteNotFound`.
- **Silent fallback to Home**: none of the six base routes fall back to
  Home. A real, different kind of silent-failure bug was found instead —
  see below.

### Critical finding — Legal and Journal detail pages were unreachable by clicking

`App.jsx`'s `navigatePath(path)` only knows two patterns for most routes:
an **exact** match (`path === "/journal"`) that calls `navigate(id)`, and
explicit slug-aware branches that exist for `/account`, `/support`,
`/orders/:id`, `/sellers/:slug`, and `/collections/:slug` (each calls
`push(path)` with the *real* requested path). `/legal` and `/journal` had
**only** the exact-match form — `navigatePath("/legal/privacy-policy")`
fell through to `if (path.startsWith("/legal")) return navigate("legal")`,
and `navigate("legal")` always pushes its fixed lookup-table path
(`/legal`), discarding the slug entirely.

Verified live, before any fix: clicking a `.legal-index-card` button
changed nothing — the URL was forced back to `/legal` and the index
re-rendered. **This means Legal's detail pages (Privacy Policy, Terms,
Cookie Policy, Refund Policy, Shipping Policy) have been unreachable via
the UI this entire time** — the only way to view one was to already know
the URL and type or load it directly. This is a pre-existing bug, not
introduced this phase, surfaced by building Journal's equivalent feature
and noticing the identical symptom.

**Fixed** in `App.jsx`: added `path.startsWith("/journal/")` and
`path.startsWith("/legal/")` branches that `push(path)` and `setRoute(...)`
directly — the exact same pattern already used for `/sellers/`,
`/orders/`, `/collections/`. A second, related issue surfaced
immediately after: `setRoute("legal")` is a no-op when `route` is already
`"legal"` (React skips re-render for an unchanged primitive state value),
so the URL updated but the view didn't, until a refresh. Fixed by adding
one new state variable, `contentPath` (set to the literal requested path
on every `navigatePath` call and on `popstate`), used as the `key` prop
on the `journal`/`legal` entries in the `pages` object — forcing a clean
remount whenever the slug changes, even when the route key doesn't.
Verified live: clicking through from both indexes now navigates
correctly, round-trips back correctly, and a direct refresh on a detail
URL still works exactly as before.

This was a deliberate, minimal, additive extension into `App.jsx` —
outside this phase's named primary-scope file list, but required to make
both Task D (Legal) and Task E (Journal, see below) actually functional
rather than cosmetically improved on top of a broken interaction. A full
regression pass (Home/Shop/Product Detail/Cart/Account/Support/unknown-
route/end-to-end checkout) confirmed no other route was affected.

## Task B — Selector ownership map (key findings)

| Selector family | Found in | Classification | Action |
|---|---|---|---|
| `.sitemap-hero`(+`-actions`), `.sitemap-grid`, `.sitemap-card`(+ variants/icon), `.finder-layout`, `.finder-panel`/`.finder-results`, `.finder-step`(+ sub), `.finder-product-stack`, `.finder-product`(+ sub) | **Full duplicate**: `client.css` (~436–520, labelled "Inner pages — Gifting · Finder · Offers · Journal") **and** `storefront.css` (~4909–5037, mislabelled "Cart / checkout page") | `merge` | `client.css`'s copy is the one actually rendering (confirmed production cascade order: client.css loads last). `storefront.css`'s copy was 100% dead weight — removed |
| `.sitemap-hero` (width/margin-inline only) | `storefront.css`, comma-grouped with the dead `.catalog-hero`/`.catalog-shell` and the live `.checkout-layout` (`CartCheckoutPage.jsx`, out of scope) | `shared, non-conflicting` | Left in place — it contributes properties `client.css` doesn't set at all, and disentangling it risks `.checkout-layout`'s width for no benefit |
| `.sitemap-hero h1`/`p` | Same compound rule, genuinely conflicting values vs. `client.css` | `merge` | `.sitemap-hero` removed from these two comma-lists; `.catalog-hero h1`/`p` remain as the same harmless dead weight they already were |
| `.gifting-payment-strip`, `.gifting-build-box-card`, `.gifting-guide-*`, `.gifting-sections-grid`, `.gifting-section-*` | `storefront.css` only | `content-page-owned` (gifting) | No cross-file duplicate — kept in place, given a proper `── Gifting guide ──` header (previously had none) |
| `.offer-list`, `.offer-row`(+ sub) | `client.css` only | `content-page-owned` (offers) | No duplicate. Added `.offer-empty` alongside it for the new empty state |
| `.legal-*` (full family), `.journal-*` (full family) | `storefront.css` only | `content-page-owned` | No cross-file duplicate. Both already had clean section headers |
| `.contact-panel` | **Nowhere** — zero CSS in any file | `dead/missing` (real bug) | Added — see Task F |
| `.store-locator-card` | **Nowhere** — zero CSS in any file | `dead/missing` (real bug) | Added — see Task G |
| `.sitemap-split` | `client.css` only, **zero JSX consumers** anywhere | `dead` | Left alone — single, self-contained, zero-risk-but-not-named-in-scope; flagged here rather than removed, consistent with this series' practice of not silently expanding a phase's deletion boundary |
| `var(--page-x)`, `var(--body)`, `var(--sand)` (direct, non-`color-mix` use) inside `.journal-*`/`.legal-*`/`.gifting-guide-card`/`.gifting-section-card` | `storefront.css` | **real bug** (undefined custom properties, Phase 1's finding) | Fixed at each in-scope call site — see Task C |

## Task C — Consolidation performed

- Removed the full dead `storefront.css` duplicate of the sitemap/finder
  family (~129 lines), replaced with a one-paragraph pointer comment to
  `client.css`.
- Removed `.sitemap-hero` from the two genuinely-conflicting compound
  `h1`/`p` rules sharing space with dead `.catalog-hero`.
- **Fixed real, previously-invisible breakage** caused by the three
  undefined custom properties Phase 1 first flagged app-wide
  (`--page-x`, `--body`, `--sand`) — an unresolvable `var()` invalidates
  its *entire* declaration, not just the broken value, so these weren't
  just losing a horizontal inset, they were silently dropping real,
  already-defined spacing tokens bundled in the same shorthand:
  - `.journal-category-nav`, `.journal-articles-grid`, `.journal-empty`,
    `.legal-grid`, `.legal-article`: `padding: 0 var(--page-x) var(--sp-N)`
    was dropping the `--sp-N` vertical spacing entirely. Fixed by
    converting to `padding-block-end: var(--sp-N)` (also a Task K logical-
    property improvement) and dropping the horizontal component — `.page-
    shell` already insets every page, so no inset value was actually lost.
  - `.legal-section-body`: `color: var(--body)` fixed to `var(--ink)`
    (also normalized its hardcoded `line-height: 1.8` to
    `var(--lh-relaxed)` since it was already being touched).
  - `.legal-footer-note`: `background: var(--sand)` (rendering as fully
    transparent) fixed to `color-mix(in srgb, var(--line) 35%, white)` —
    a real, visible, soft warm-neutral tint instead of nothing.
  - `.gifting-guide-card`, `.gifting-section-card`: `border: 1px solid
    color-mix(in srgb, var(--line) 82%, var(--sand))` (rendering with no
    border at all) fixed to a plain `border: 1px solid var(--line)`,
    matching every working sibling card's actual border treatment.
  - None of the eight unresolved custom properties were defined anywhere
    — every fix replaced a broken reference with an already-existing,
    already-defined token at that specific call site.
- Added missing section headers: `── Gifting guide ──` (had none before)
  and a new `── Customer service ──` section for the new `.contact-panel`.
- No `client.css`-loads-last reliance was introduced — every new rule is
  the sole definition of its selector.

## Task D — Legal page

- **Fixed the click-through bug** (see Task A) — Legal's five policies
  are now actually reachable by clicking, not just by direct URL.
- **Added a table of contents**: each policy with more than one section
  (4 of 5 — Cookie Policy has multiple too) now shows an "On this page"
  jump-link list above the content, using each section's own heading text
  (no invented labels). Anchor IDs are slugified from the real heading
  text. `scroll-margin-top: 5rem` added to `.legal-section` so the sticky
  topbar (`.cl-topbar`, confirmed `position: sticky`) never covers the
  target heading — verified live (target heading's top was 131px from
  viewport top after a jump, comfortably clear).
- **Migrated the one inline style** (`style={{ padding: "var(--sp-8)
  var(--sp-4)" }}` on the old not-found branch) by replacing that whole
  branch with `RouteNotFound` (Task H), which has no inline styles at all.
- **Readability**: added `max-width: 38rem` to `.legal-section-body`
  (comfortable line length, independent of `.legal-article`'s wider
  720px container) and fixed the broken color/line-height noted above.
- No legal content, wording, or meaning was invented or changed — only
  `legalPages`/`legalContent` (`siteMap.js`) supplied the text; this
  phase only changed presentation.

## Task E — Journal page

- **Fixed a dropped prop**: `JournalPage()` was declared with no
  parameters at all, even though `App.jsx` already passed
  `onNavigate={navigatePath}` — meaning the prop was silently discarded
  every render. Now `JournalPage({ onNavigate })`.
- **Added a real article detail view** — `journalArticles` (`siteMap.js`)
  already modeled each article with its own `path` (e.g.
  `/journal/how-to-choose-a-perfume`), but nothing ever read it; cards
  were inert `<article>` elements with no click handler at all. Mirrored
  `LegalPage`'s own established pattern (read the slug from
  `window.location.pathname`, branch index vs. detail in the same
  component) rather than inventing a new one. The detail view shows only
  data that already exists — category, title, date, read time, and the
  existing `summary` text as the lead paragraph. **No article body
  content was invented** — there is no body field in the data model, and
  none was added.
- **Not-found handling**: an unknown article slug now renders
  `RouteNotFound` instead of silently falling through to show the
  unfiltered list with no acknowledgement that the requested article
  doesn't exist.
- **Cards are now real interactive elements**: `ArticleCard` changed from
  a non-interactive `<article>` to a `<button className="journal-article-
  card">` (same wrap-the-heading-in-a-button pattern `LegalPage`'s own
  `.legal-index-card` already established — see Task I for the
  accessibility trade-off this implies), with a proper button-style reset,
  hover, and `:focus-visible` (confirmed via real keyboard Tab+Enter, not
  just a programmatic focus call) and keyboard activation.
  Verified end-to-end: Tab reaches the card, the browser's native focus
  ring shows, Enter navigates to the correct detail URL.
- **Image/fallback treatment**: there is no image field in the article
  data, so no photo or photo-placeholder was added (that would mean
  inventing imagery). Instead, each card got a small category-tinted icon
  badge (`.journal-article-thumb`, reusing the existing `BookOpen` icon
  with category-specific color variants for "oud" and "gifting") — a
  CSS-only visual identity, not a fabricated image.
  - **Related articles**: the detail view felt sparse on its own (just a
  one-paragraph summary) — added a "More from the Journal" section
  showing up to 3 *other* real articles (excluding the current one),
  reusing the same `ArticleCard` and existing `.journal-articles-grid`.
  This is genuine existing data resurfaced in a new context, not new
  content.
- Fixed a real, narrowly-scoped touch-target gap: `.journal-cat-btn` was
  29px tall (Task I) — raised to 44px via `min-height`. This is distinct
  from the broader, already-documented (Phase 1) app-wide 34–40px
  `.compact`/`.primary-action`/etc. divergence, which was left untouched
  (out of scope — see Task I).

## Task F — Gifting and Customer Service

- **Fixed a real heading-hierarchy gap**: the Birthday/Anniversary/Eid/
  Corporate-gifting occasion cards used `<h3>` with no `<h2>` anywhere
  above them in that part of the page — an h1 → h3 skip. Added the
  missing `<h2>Shop by occasion</h2>` section title (new, but purely
  organizational copy, not a content/business claim) rather than
  flattening the cards to `<h2>` — confirmed via a full heading-sequence
  dump that the page now reads H1 → H2 → H2 → H3×4 → H2×3 → H2×6 with no
  skips anywhere.
- **Fixed `.contact-panel` having zero CSS anywhere** — the same class of
  bug Phase 7 found in `.account-grid`/`.account-card` and Phase 8 found
  in `.app-fatal-state`. `CustomerServicePage`'s "Contact us" panel
  (heading `support@tuti.example`, description, "Open support tickets"
  button) was rendering as unstyled stacked text. Added a calm,
  text+action card consistent with the rest of this page family,
  responsive at 520px.
- Customer Service's per-topic sub-paths (`/customer-service/faqs`,
  `/customer-service/shipping`, etc., from `supportSections` in
  `siteMap.js`) were confirmed to intentionally converge on the same
  overview page — there is no per-topic body content anywhere in the data
  model (each only has a one-line grid-card description, already shown),
  so building six near-empty "detail" pages would have been pure
  redundant scaffolding, not a real feature. Left as-is.

## Task G — Store Locator and Offers

- **Fixed `.store-locator-card` having zero CSS anywhere** — same bug
  class as `.contact-panel`. Styled as a calm, centered, honest "coming
  soon" card — confirmed there is genuinely no real store/location data
  anywhere in this codebase (the page's own copy already says so), so no
  address, hours, map, or contact detail was invented.
- Added one small, honest cross-link ("Delivery questions? Visit customer
  service") to a real, existing page — reduces the page's visual
  emptiness without fabricating store data to fill the space.
- **Added the missing empty state to Offers**: `promotions.map(...)`
  previously rendered nothing at all if the array was empty — no message,
  no CTA. `promotions` is real backend data (`storefront.promotions`,
  currently 3 seeded entries) so this was untested-but-real risk, not a
  hypothetical. Verified by intercepting the storefront API response and
  forcing an empty array: the new `.offer-empty` state (icon, message,
  "Go to Shop" CTA) renders correctly.
- No discounts, campaign terms, or promotional copy were invented — the
  three existing seeded promotions (`promo-gift-sets`, `promo-eid-edit`,
  `promo-cakes`) were read directly from `backend/src/seed/
  marketplace.seed.js` to confirm `OffersPage` already renders real data
  correctly; nothing about that rendering was changed.

## Task H — Route-state integration

- `RouteNotFound` (Phase 8) is now used by Legal's not-found branch
  (replacing its old bespoke `PageHero` + manual back-button) and by the
  new Journal not-found branch.
- `RouteAuthRequired`/`RouteLoading`/`RouteErrorState` were not applicable
  to any of these six pages — none of them require authentication or
  have a loading/error state of their own (they all consume the same
  already-fixed App-level catalog state from Phase 8).
- Per the brief's explicit caution, route-state components were **not**
  forced onto pages with valid static content — Gifting, Customer
  Service, Store Locator, and Offers's main bodies were left as their
  own page-specific layouts; only the two genuinely-missing "this
  specific item doesn't exist" cases were converted.

## Task I — Accessibility

Verified live (Playwright, real keyboard interaction where relevant) on
all six pages and their detail/empty variants (12 page-states total):

- Exactly one `<h1>` on every page-state checked.
- Zero duplicate `id` attributes anywhere (the new `.legal-toc` anchor
  IDs were spot-checked for collisions across all 5 policies — none).
- Zero `<svg>` inside `<main>` without `aria-hidden="true"` (every new
  icon — `.journal-article-thumb`, `.store-locator-card`'s `MapPin`,
  `.offer-empty`'s icons — was written with it from the start).
- Zero icon-only buttons without an accessible name.
- **Heading-inside-button**: `.journal-article-card` (new) and
  `.legal-index-card` (pre-existing, Phase 4-era) both wrap an `<h2>`
  inside a `<button>`. This is a deliberate, consistent choice, not an
  oversight: it's the established pattern for this exact page family
  (whole-card-is-clickable, title inside), HTML5 permits headings inside
  buttons as flow content, and it is not one of D0.1's hard-fail
  criteria. Rebuilding every clickable card in this family to move the
  heading outside the interactive element would be a larger redesign
  than this phase's brief calls for — flagged here as a known, consistent,
  pre-existing-pattern choice rather than silently left unmentioned.
- **Touch targets**: `.journal-cat-btn` (29px, real bug, in narrow scope)
  fixed to 44px. The broader `.primary-action`/`.secondary-action`/
  `.ghost-action`/`.icon-button`/`.compact` 34–40px sizing was confirmed
  present (e.g., on Gifting's and Customer Service's action buttons) but
  is the same already-documented (Phase 1), deliberately-deferred,
  app-wide issue every prior phase has also found and left alone —
  fixing it here would be an app-wide change disguised as a content-page
  fix.
- `:focus-visible` confirmed functional via real Tab navigation (not
  just programmatic `.focus()`, which doesn't reliably trigger
  `:focus-visible`'s heuristics) on the new Journal cards and Legal's TOC
  links; Enter-key activation confirmed to navigate correctly.
- No keyboard traps — none of this phase's new surfaces are modals.
- Long content (legal section text, journal summaries) wraps safely at
  every tested width — confirmed via the responsive pass below.

## Task J — Responsive results

32 combinations checked (8 routes × 4 widths: Legal index, Legal detail,
Journal list, Journal detail, Gifting, Customer Service, Store Locator,
Offers — all at 375/768/1280/1440px): **0px horizontal overflow, 0
console errors on every single one.**

At 375px (screenshotted): Legal's TOC and sections stack cleanly with
comfortable line length; Journal's cards stack to one column; action
rows wrap without overlap. At desktop: `.legal-section-body`'s 38rem cap
and `.legal-article`'s 720px cap keep policy text from spanning too wide;
Gifting's and Journal's grids fill the available width without looking
sparse (the related-articles addition directly addressed the one spot —
Journal's article detail — that looked oversized/empty before it).

## Task K — CSS quality

- Zero `!important` introduced.
- Zero new undefined custom properties — verified by checking every
  selector this phase added or touched individually; the only undefined-
  variable interactions this phase had were *fixing* existing broken
  references, never adding new ones.
- Logical properties used for every new/touched spacing rule
  (`padding-block-end`, `padding-block`) rather than physical shorthands.
- The one new breakpoint added (`.contact-panel`'s mobile stack) uses the
  canonical `520px`. No new one-off breakpoints were introduced; the
  Journal grid's pre-existing `900px`/`600px` breakpoints were reused
  as-is (not introduced this phase, left as the documented one-off
  exception they already were).
- No unrelated page rule was altered — every edit was traced to a named
  selector this phase's scope covers, verified by reading full
  surrounding context (comma-lists, descendant rules) before touching
  anything, per Task B's instruction.

## Lines and bundle size

| Metric | Before Phase 9 | After Phase 9 | Change |
|---|---|---|---|
| `storefront.css` lines | 10,769 | 10,843 | +74 (net: removed a ~140-line dead duplicate block, added new Customer Service/Store Locator CSS, Legal TOC, Journal thumb/detail/related sections, section headers) |
| `client.css` lines | 2,513 (Phase 3 end; untouched since) | 2,525 | +12 (`.offer-empty`) |
| `App.jsx` lines | 497 | 517 | +20 (navigation fix + `contentPath` state) |
| `LegalPage.jsx` lines | 105 | 121 | +16 (TOC, RouteNotFound) |
| `JournalPage.jsx` lines | 76 | 148 | +72 (detail view, related articles, fixed prop) |
| `GiftingPage.jsx` lines | 154 | 156 | +2 (section wrapper + heading) |
| `CustomerServicePage.jsx` lines | 29 | 28 | −1 (no logic change, formatting) |
| `StoreLocatorPage.jsx` lines | 20 | 24 | +4 (cross-link) |
| `OffersPage.jsx` lines | 38 | 48 | +10 (empty state) |
| Customer web CSS bundle (raw) | 240.63 kB | 241.99 kB | +1.36 kB |
| Customer web CSS bundle (gzip) | 41.88 kB | 42.23 kB | +0.35 kB |
| Seller / Admin / Driver / SR bundles | unchanged | unchanged | **0 bytes — guaranteed**: this phase touched no file under `packages/shared/` |

## Verification

- CSS comment-balance: `storefront.css` 173/173, `client.css` 65/65 —
  both balanced.
- `git diff --check` — clean.
- `npm run test:critical-smoke` — 5/5 pass.
- `npm run build` — all five workspaces build clean.
- Functional: all six routes load directly and on refresh; Legal and
  Journal index-to-detail click-through confirmed working (previously
  broken for Legal, newly built for Journal); both round-trip back to
  their index correctly; unknown Legal/Journal slugs show
  `RouteNotFound`; the Offers empty state was forced via a mocked
  zero-length `promotions` array and confirmed rendering correctly.
- **Explicit no-regression checks**: Home, Shop, Product Detail, Cart,
  Account (signed-out), Support (signed-out), Reset Password, Build a
  Box, an empty seller-brand slug, and an unrelated unknown route all
  re-checked at 0px overflow / 0 console errors after the `App.jsx`
  navigation fix; a full live checkout was re-run end-to-end and produced
  a real order confirmation, confirming the shared `navigatePath`
  function's edit didn't regress any other route.

## Pre-existing work preserved

All pre-flight items are present and unchanged after this phase. Phase
9's own changes: `App.jsx`, `storefront.css`, `client.css`,
`LegalPage.jsx`, `JournalPage.jsx`, `GiftingPage.jsx`,
`CustomerServicePage.jsx` (touched, net same line count), `StoreLocatorPage.jsx`,
`OffersPage.jsx` modified; this document and the D0.2 entry added. No
file under `packages/shared/` or in Shop/Product Detail/Cart/Checkout/
Account/Support/backend/seller/admin/driver/SR was touched.
`sitemapPageShared.jsx` was read and imported from but never edited.

## Remaining content-page debt

- The app-wide 34–40px `.compact`/`.primary-action`/`.secondary-action`/
  `.ghost-action`/`.icon-button` touch-target divergence (Phase 1)
  remains, visible on Gifting's and Customer Service's action buttons —
  same already-documented, deliberately-deferred issue as every prior
  phase.
- `.sitemap-split` (`client.css`) remains defined with zero JSX
  consumers — flagged, not removed, since it wasn't named in this
  phase's scope and removing it would be a small scope expansion for a
  single harmless dead rule.
- `.legal-index-card`'s (and now `.journal-article-card`'s)
  heading-inside-button pattern remains — a deliberate, consistent,
  non-hard-fail choice, not a defect, documented above (Task I).
- Customer Service's per-topic sub-paths still converge on one overview
  page — correct given the current data model, but would need real
  per-topic content authored before a future phase could justify
  splitting them into genuine detail pages.
- Store Locator remains an honest placeholder — correct given there is
  no real store data anywhere in this codebase yet.

## Recommendation for Phase 10

1. If real store/pickup-location data is ever added to the backend,
   Store Locator is the page to revisit first — the current placeholder
   was deliberately built not to need a redesign, just real data dropped
   into the same card pattern (or a small list of them).
2. If Customer Service's topics ever get real per-topic content
   authored, the same slug-detail pattern this phase used for
   Legal/Journal (read the slug from the path, branch index vs. detail
   in one component) is the lowest-risk way to add it.
3. Apply this phase's "read the full comma-list/descendant context
   before touching anything" discipline (Task B) to the still-undescribed
   `.path-*`/`.gift-preview*`/`.trust-closing-*`/`.featured-product-*`
   families Phase 3 deferred relocating — they're a different kind of
   debt (ownership, not duplication) but the same investigative method
   applies.
