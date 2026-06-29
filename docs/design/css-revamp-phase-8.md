# CSS Revamp Phase 8 — Cross-Route Loading, Empty, Error, and Route-State Architecture

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
?? apps/web/src/features/homepage/GiftingShortcuts.jsx
?? apps/web/src/features/storefront/components/ShopFilterDrawer.jsx
?? apps/web/src/features/storefront/components/ShopToolbar.jsx
?? docs/design/css-revamp-audit.md
?? docs/design/css-revamp-phase-2.md
?? docs/design/css-revamp-phase-3.md
?? docs/design/css-revamp-phase-4.md
?? docs/design/css-revamp-phase-5.md
?? docs/design/css-revamp-phase-6.md
?? docs/design/css-revamp-phase-7.md
```

Exactly Phase 7's end state. This phase touched **zero files under
`packages/shared/`** — unlike Phases 5 and 7, Seller/Admin/Driver/SR are
guaranteed byte-identical, not just verified identical.

## Mandatory comment safety rule — how it was followed

Phases 6 and 7 each broke their own build by writing a literal `*/`
sequence inside a CSS comment's prose (both times while describing a
wildcard-style selector name next to a path separator). This phase's brief
made avoiding that a named requirement, so the new CSS was written
**outside** `storefront.css` first — in a scratch file — and checked for
comment balance there before being appended, rather than edited in place
inside the 10,500+ line production file. Every single CSS edit this phase
(there were two: the initial section append, and one later addition) was
followed immediately by a balance check
(`(content.match(/\/\*/g)||[]).length === (content.match(/\*\//g)||[]).length`)
before the next build. Both passed on the first attempt — this is the
first phase in this series with zero CSS-comment build breaks.

## Task A — Current route-state architecture (as found)

| State | Owner | Data source | Trigger | Current UI (before) | Retry? | Blocks whole app? | Preserves route? | Accessible? |
|---|---|---|---|---|---|---|---|---|
| Initial app loading | `App.jsx` | `marketplaceApi.getStorefront()` | Always, on mount | Bare `<div className="cl-loading">` — no header | No | **Yes** | No (header gone) | `role="status" aria-live="polite"` only |
| Public product/catalog loading | Same as above (one fetch, no separate state) | — | — | — | — | — | — | — |
| Authenticated user loading | None — `useAuthStore`'s `persist` middleware hydrates `user` synchronously from `localStorage` before first render | `localStorage` | N/A | N/A (no loading period exists) | N/A | N/A | N/A | N/A |
| Route-level loading | None at the App.jsx level. `SupportTicketsPage`, `OrderConfirmationPage`, and `AccountPage`'s own orders fetch each have their **own**, already-independent, already-working loading states (react-query / local `useState`) | Per-page | Per-page | Per-page (already fine) | Per-page | No | Yes | Yes | Mostly yes (verified in Phases 6–7) |
| API error (catalog) | `App.jsx` | Same fetch as above | Fetch rejects | Bare `<div className="cl-error">` — no header | Yes, but via `window.location.reload()` (full page reload) | **Yes** | No | `role="alert"` only |
| Route not found (unknown path) | `getRoute()`'s fallback | URL path | Any unmatched path | **None — silently rendered as Home** | N/A | No | No (looks like Home) | N/A |
| Product not found | `ProductDetailPage.jsx` | `products.find(...)` returns nothing | Bad/missing/non-Live product ID | `.not-found-panel` — heading + one action, no explanation | No (n/a) | No | Yes | Mostly (no explanation text) |
| Empty marketplace (zero live products) | `StorefrontPage.jsx` | `liveProducts.length === 0 && !hasActiveFilters` | Phase 4's fix | Already good | N/A | No | Yes | Yes |
| Empty filtered results | `StorefrontPage.jsx` | `sortedProducts.length === 0` | Search/filter narrows to zero | Already good | N/A | No | Yes | Yes |
| Empty cart | `CartCheckoutPage.jsx` | `cart.length === 0` | Phase 6's fix | Already good | N/A | No | Yes | Yes |
| Empty wishlist | `AccountPage.jsx` | `wishlistProducts.length === 0` | Phase 7's fix | Already good | N/A | No | Yes | Yes |
| Empty orders | `AccountPage.jsx` | `orders.length === 0` | No orders yet | Already good | N/A | No | Yes | Yes |
| Empty support tickets | `SupportTicketsPage.jsx` | `visibleTickets.length === 0` | No tickets / filtered to zero | Already good (`EmptyState`) | N/A | No | Yes | Yes |
| Unavailable private/non-live records | `ProductDetailPage.jsx` / `OrderConfirmationPage.jsx` | Server never returns them at all (Phases 5–6 verified) | N/A | Collapses into "not found"/"unauthorized" | — | No | Yes | Yes |
| Auth-required (Support) | `SupportTicketsPage.jsx` | `!isAuthenticated()` | Already existed, bespoke markup | Sign in + secondary action | N/A | No | Yes | Yes |
| Auth-required (Account) | `AccountPage.jsx` | `!isAuthenticated()` | **No in-page sign-in action existed** — only the header's chip | 4 informational cards (Phase 7), no CTA | N/A | No | Yes | Partial |

Two real bugs were found while building this map, both fixed this phase
(see Task D):
1. The catalog-loading `useEffect` listed `isAuthenticated()` as a
   dependency despite never reading its value inside the effect — every
   login/logout silently re-fetched the entire public catalog and
   re-flashed the blank app-level loading screen.
2. There was no React error boundary anywhere in the app — a genuinely
   fatal render crash (distinct from the already-handled catalog-fetch
   failure) would have produced a blank white screen with zero recovery
   UI, not a graceful fallback.

## Task B/C — The new route-state pattern

One new file, `apps/web/src/features/layout/RouteState.jsx`, exports four
focused, composable components — deliberately not a state-management
library, just plain React components taking plain props:

- **`RouteLoading`** — a calm skeleton (a few shimmering blocks) plus a
  polite, announced label. Not full per-page skeletons (see "why no
  per-page skeletons" below).
- **`RouteErrorState`** — heading, customer-facing message, an optional
  retry button, an optional secondary action. Both actions are opt-in via
  props (`onRetry`/`onSecondary`) — a state with nothing useful to retry
  or navigate to simply omits the button rather than rendering a dead one.
- **`RouteNotFound`** — heading, explanation, primary + secondary
  navigation actions. Reused with different copy for both the app-level
  "unknown route" case and `ProductDetailPage`'s "product not found" case,
  per the brief's explicit "appropriate use for product not found and
  unknown route, with copy adjusted per context."
- **`RouteAuthRequired`** — heading, explanation, a sign-in action
  (dispatches the existing `tuti:open-auth` event — no new auth plumbing)
  and a "continue browsing" secondary action.

All four share one CSS shell (`.route-state-panel`) for the card
container, heading, and body text, plus `.route-state-actions` for the
button row — but each is its own named class
(`.route-error-state`/`.route-not-found-state`/`.route-auth-required-state`)
so page-specific tuning has somewhere to go later without re-touching the
shared base, matching the brief's "do not force every empty state into
the exact same visual component."

**Existing page-specific empty states were deliberately left alone.**
`.shop-empty-state`, `.account-empty-state`, and the shared `EmptyState`
component (Shop, Cart, Wishlist, Orders, Support ticket list/detail) were
already structurally consistent with each other (icon, heading, message,
action — confirmed in Phases 4, 6, and 7) before this phase started. Per
Task B's explicit instruction, they were not merged into the new
`RouteState` components or rewritten — doing so would have been a
redesign of already-approved, already-working pages for no behavioural
gain.

**Why no per-page loading skeletons**: the brief's "recommended pattern"
allows for skeletons "matching the page type," but the only loading state
this phase's scope actually controls is the *one-time, app-level* initial
catalog fetch — which happens before any route's real content exists to
shape a skeleton after, and is typically sub-second on a healthy
connection. Building five distinct page-shaped skeletons for a transient,
rarely-visible state was judged disproportionate to the actual problem
(the header disappearing, not the loading indicator being insufficiently
fancy) — recorded here as a deliberate scope decision, not an oversight.

## Task D — App-level loading/error refinement

- **Both real bugs fixed.** The `isAuthenticated()` dependency was
  removed from the catalog-fetch `useEffect` (now `[]`, runs once on
  mount) — confirmed live: the storefront endpoint was called once per
  page lifetime regardless of how many times a test session logged in
  and out (previously confirmed live, before the fix, to increment by
  one additional call per login). A new `AppErrorBoundary` (class
  component, `apps/web/src/AppErrorBoundary.jsx`) now wraps `<App />` in
  `main.jsx`, catching genuinely fatal render crashes with a minimal,
  deliberately layout-independent fallback (no header, no app state — if
  something crashed badly enough to reach this boundary, nothing else is
  assumed safe to render).
- **Header/layout now stays visible during loading and recoverable
  errors.** `App.jsx`'s `if (loading || loadError)` branch now renders
  `<ClientLayout>` (confirmed via full read to have no dependency on
  `products`/`shops`/`storefront` data at all) wrapping `<RouteLoading>`
  or `<RouteErrorState>`, instead of a bare blocking `<div>`. Verified
  live: header, search, account chip, cart icon, mobile drawer, and the
  auth modal are all still interactive while the catalog is loading or
  has failed to load.
- **Retry re-runs the fetch in place, no page reload.** The fetch logic
  was extracted into a named `loadStorefront(mountedRef)` function so the
  error state's retry button can call it directly. Verified live with a
  simulated 500 response: the error panel appeared with the header intact,
  clicking "Try again" re-fetched and the homepage rendered normally
  afterward — no full browser reload occurred.
- **No duplicate fetches, no infinite retry loop.** The effect now runs
  exactly once per mount (`[]` dependency); retry is a manual, user-
  triggered action, not an automatic loop. (React 18 StrictMode's
  development-only double-invoke-on-mount behavior, confirmed present via
  `main.jsx`, was ruled out as the cause of the *original* bug — that
  double-invoke is constant across every mount and does not explain why
  the call count specifically increased on login/logout; the
  `isAuthenticated()` dependency was the actual cause, confirmed by
  removing it.)
- **What remains app-wide, and why**: a true render crash anywhere in the
  tree still falls through to `AppErrorBoundary`'s minimal fallback —
  intentionally, since at that point the header/layout can no longer be
  assumed renderable. This is the one deliberately-retained "app-wide
  fatal state" the brief asks to keep.

## Task E — Page-level integration

Three integrations, all additive — no existing successful UI was
redesigned, no business logic changed:

- **`AccountPage.jsx`** (signed-out view): added `<RouteAuthRequired>`
  directly above the existing, Phase-7-fixed `.account-grid` preview
  cards. The cards are unchanged; this phase only adds the in-page
  "Sign in" action that was missing (previously the only way to sign in
  from this page was the header chip).
- **`SupportTicketsPage.jsx`** (signed-out view): replaced a bespoke
  `EmptyState` + manual two-button row with `<RouteAuthRequired>`,
  preserving the exact same two destinations (sign in via the same
  `tuti:open-auth` event; "View customer service"). Removed the
  now-unused `HelpCircle` import this left behind.
- **`ProductDetailPage.jsx`** (product-not-found branch): replaced the
  minimal `.not-found-panel` (heading + one button, no explanation) with
  `<RouteNotFound>`, adding the missing explanation line the brief asks
  for. `.not-found-panel` itself was not touched or removed — confirmed
  still live via `SellerBrandPage.jsx` and `CollectionPage.jsx`, both out
  of this phase's scope.
- **Shop, Cart/Checkout, Reset Password**: read and confirmed already
  consistent (Phases 4, 6, 7) — no wrapper replaced, since none was
  inconsistent. Reset Password in particular already has clear
  step-by-step states (request/sent/new-password/done) that don't map
  onto "loading/error/not-found/auth-required" at all — it's a multi-step
  form flow, not a route-state problem.
- **Homepage**: not touched, per the brief — it has no loading/error
  state of its own (it consumes the same now-fixed App-level state).

## Task F — CSS ownership

One new section appended to the end of `apps/web/src/styles/storefront.css`
(not interleaved with existing content, to minimize risk to the
cascade-order-sensitive rules documented in every prior phase), using
exactly the brief's preferred sub-section order: `Route states` /
`Route skeletons` / `Route error states` / `Route not-found states` /
`Route auth-required states` / `Empty states` / `Route-state responsive`.
The "not-found"/"auth-required"/"empty states" sub-sections are present
as named anchors with an explanatory comment rather than new rules,
since (respectively) they need no overrides beyond the shared panel
styles, and existing empty states were deliberately left in their
current locations (Task B). Nothing was added to `packages/shared/styles/
base.css` — the new surfaces are visually specific to this app's existing
"warm card" language (gradient backgrounds, `--sand`-mixed borders) that
the rest of `storefront.css` already establishes, not app-neutral
primitives.

**A real touch-target gap was found and fixed during accessibility
verification** (Task G): the new components use the shared `.primary-
action`/`.ghost-action` classes for their buttons, which inherit the
already-documented (Phase 1) 40px base height. Rather than touching that
shared base — which would affect every button in every app — a scoped
override (`.route-state-actions .primary-action, .route-state-actions
.ghost-action { min-height: 2.75rem; }`) raises only these specific
buttons to 44px, the same pattern already used for `.account-tab`
(Phase 7) and the Product Detail/Cart quantity steppers (Phases 5–6).

No `!important`, no raw colours where a token exists, no new undefined
custom properties (the one pre-existing exception, `var(--sand)`, is used
exactly the way every prior phase has already used it — referenced, never
defined). The skeleton shimmer uses a CSS `@keyframes` animation disabled
entirely under `@media (prefers-reduced-motion: reduce)` (Task G).

**A second real gap was found and fixed before final verification**:
`AppErrorBoundary.jsx`'s fallback markup (`.app-fatal-state`/
`.app-fatal-card`) had no CSS at all — it would have rendered as
unstyled, unpositioned text if a fatal crash ever actually reached it,
the same category of bug Phase 7 found in `.account-grid`/`.account-
card`. Fixed with a small, deliberately self-contained section (its own
`position: fixed` full-viewport host, hardcoded fallback colour values
rather than tokens, since this fallback must keep rendering correctly
even in a hypothetical future where token loading itself is part of
what's broken) appended after the Route states section. Verified by
injecting the exact fallback markup into a live page and confirming its
computed styles (centered, rounded card, capped width) rather than by
forcing an actual React crash, since the boundary's own logic
(`getDerivedStateFromError`/`componentDidCatch`) is a standard,
already-correct React pattern — the only real risk was the missing CSS,
now confirmed fixed.

## Task G — Accessibility

Verified live (Playwright) and by direct code reading:
- `RouteLoading` uses `role="status" aria-live="polite"` — confirmed the
  attribute is present and the header remains in the accessibility tree
  alongside it (not replaced).
- `RouteErrorState` uses `role="alert"`. `RouteNotFound`/
  `RouteAuthRequired` use `role="status"` (informational, not urgent
  interruptions).
- Retry/sign-in/navigation buttons all have clear, literal text labels
  (no icon-only actions in any new component).
- Exactly one `<h1>` confirmed on the not-found page, the signed-out
  Account page, the signed-out Support page, and the product-not-found
  page (each checked individually, not assumed).
- Zero duplicate `id` attributes on any of the above.
- Zero `<svg>` without `aria-hidden="true"` inside `<main>` on any of the
  above (every icon in `RouteState.jsx` and `AppErrorBoundary.jsx` was
  written with `aria-hidden="true"` from the start, not retrofitted).
- Zero headings nested inside buttons.
- **Touch targets**: found and fixed (see Task F) — confirmed 44×44px
  live after the fix, for every action button across all four new
  surfaces.
- `:focus-visible` confirmed functional on the not-found page.
- `prefers-reduced-motion: reduce` confirmed live to disable the skeleton
  shimmer entirely (`animation-name: none`), falling back to a static
  muted-tone block instead of an endless shimmer.
- No keyboard trap — none of the new surfaces are modals; the existing
  auth modal (untouched) remains the only focus-managed overlay in the app.

## Task H — Responsive results

Verified live and via screenshots at all four required widths on the
not-found page (representative of all four new surfaces, which share the
same `.route-state-panel` shell):

| Width | Overflow | Notes |
|---|---|---|
| 375px | 0px | Actions stack to full width via the new responsive rule; card padding scales down via existing `clamp()` values |
| 768px | 0px | — |
| 1280px | 0px | — |
| 1440px | 0px | — |

At desktop, `.route-state-panel` is capped at the same `var(--max-width)`
container width used throughout the rest of the app (not full-bleed), so
it never reads as oversized; the panel's `justify-items: start` keeps
text left-aligned and readable rather than centered-and-isolated on a
wide screen.

## Task I — Verification scenarios

All run live against the local dev server, none against production data:

- **Loading**: initial app load (network throttled via Playwright route
  interception, not a real slow connection) — confirmed header visible,
  skeleton visible, `aria-live="polite"` present.
- **Error**: catalog fetch simulated to fail (mocked 500 response,
  accounting for React StrictMode's development-only double-invoke so
  the simulated failure reliably reached the assertion) — confirmed
  header visible, customer-facing message shown (no stack trace, since
  the app already maps `err.message` from the API's own `error` field,
  never a raw exception), retry recovers without a full reload.
- **Not found**: an unknown path and a non-existent product ID both
  verified to render the correct, context-appropriate copy via the same
  underlying component.
- **Empty**: Shop's filter-empty state (nonsense search term) reconfirmed
  still working — a pure regression check, since this phase didn't touch
  it.
- **Auth**: Account and Support's signed-out states both verified to
  show the sign-in CTA and to actually open the auth modal when clicked
  (not just render correctly).

Local data/backend state was not damaged by any of this — the simulated
failures were intercepted at the network layer (Playwright route mocking)
and never reached the real backend; the real backend's data (orders,
wishlist, tickets) was only added to via normal, successful requests
during the separate functional-regression checks below.

## Lines and bundle size

| Metric | Before Phase 8 | After Phase 8 | Change |
|---|---|---|---|
| `storefront.css` lines | 10,569 | 10,769 | +200 (Route states section + the later app-fatal-state fix) |
| `App.jsx` | — | 497 | Net effect of this phase's edits: not-found route entry, `loadStorefront` extraction + comments, loading/error render block — all additive, no deletions of existing logic |
| `main.jsx` lines | 27 | 29 | +2 (AppErrorBoundary import + wrap) |
| `AppErrorBoundary.jsx` | — | 40 | New file |
| `RouteState.jsx` | — | 120 | New file |
| `AccountPage.jsx` lines | 721 | 730 | +9 (RouteAuthRequired integration) |
| `SupportTicketsPage.jsx` lines | 636 | 632 | −4 (bespoke block replaced with a shared component call; one unused import removed) |
| `ProductDetailPage.jsx` lines | 601 | 601 | Net zero (one import line added, not-found branch body shortened by the same amount) |
| Customer web CSS bundle (raw) | 237.92 kB | 240.63 kB | +2.71 kB |
| Customer web CSS bundle (gzip) | 41.37 kB | 41.88 kB | +0.51 kB |
| Seller / Admin / Driver / SR bundles | unchanged | unchanged | **0 bytes — guaranteed, not just measured**: this phase touched no file under `packages/shared/` |

## Verification

- CSS comment-balance check on every touched CSS file — `storefront.css`
  (164/164), `client.css` (65/65, untouched this phase, checked anyway),
  `base.css` (3/3, untouched, checked anyway) — all balanced before the
  build that confirmed it.
- `git diff --check` — clean.
- `npm run test:critical-smoke` — 5/5 pass, including "checkout authority
  and COD-only checkout" and "refresh token rotation."
- `npm run build` — all five workspaces build clean.
- Functional, live-browser checks: Home/Shop/Product Detail/Cart/Account/
  Support/Reset Password/Legal/Journal all load with 0px overflow and 0
  console errors; the auth modal opens and closes correctly from the new
  Account/Support sign-in CTAs; the not-found page's "Go to Shop" action
  navigates correctly; the product-not-found page's "Back to shop" action
  navigates correctly; a simulated catalog error's retry button recovers
  the app without a page reload.
- **Explicit "no successful route regressed" checks**: Product Detail's
  quantity stepper (+2 clicks → quantity 3 in the persisted cart),
  end-to-end checkout (a real order was placed and a real `/orders/
  ORD-...` confirmation page rendered), and Shop's category filter (6
  cake cards after selecting "Cakes & Desserts") were all independently
  re-verified working after this phase's changes, not assumed safe.

## Pre-existing work preserved

All pre-flight items are present and unchanged after this phase. Phase
8's own changes: `App.jsx`, `main.jsx`, `AccountPage.jsx`,
`SupportTicketsPage.jsx`, `ProductDetailPage.jsx`, and `storefront.css`
modified; `AppErrorBoundary.jsx` and `RouteState.jsx` added; this document
added. No file under `packages/shared/` was touched.

## Remaining route-state debt

- **Reset Password's multi-step flow is intentionally outside this
  system** — it's a sequential form (request → sent → new-password →
  done), not a loading/error/not-found/auth-required state, and forcing
  it into `RouteState` would be a mismatch, not a consolidation.
- **No per-page loading skeletons** — a deliberate scope decision (see
  Task B), not an oversight; revisit only if the one-time app-level fetch
  ever becomes meaningfully slower in practice.
- The already-documented (Phase 1) 40px `.compact`/`.icon-button`/
  `.primary-action`/`.secondary-action`/`.ghost-action` base touch-target
  divergence remains everywhere *except* inside `.route-state-actions`,
  which this phase scoped around rather than fixed at the source.
- `OrderConfirmationPage.jsx`'s own not-found/unauthorized/error states
  (Phase 6) were read and confirmed already at-or-above the bar
  `RouteNotFound`/`RouteErrorState` would provide, and were deliberately
  left as their own bespoke (already good) implementations rather than
  migrated — migrating already-good, already-verified code for
  consistency's sake alone was judged unnecessary churn.

## Recommendation for Phase 9

1. If the shared 40px button-height divergence is ever addressed app-wide
   (recommended once already, in Phase 7), the `.route-state-actions`
   scoped override introduced this phase becomes redundant and can be
   removed at the same time.
2. If a future phase adds genuinely slow, data-heavy initial routes, that
   would be the right moment to revisit per-page loading skeletons —
   `RouteLoading`'s `label` prop already supports page-specific framing
   today; shaping the skeleton blocks themselves per route is the natural
   next step if it becomes necessary.
3. Apply this phase's "extract before touching the big file" CSS-safety
   technique (write new CSS to a scratch file, balance-check it, append,
   balance-check again) as standard practice for any future phase adding
   a substantial new CSS section, given it produced this series' first
   zero-comment-break phase.
