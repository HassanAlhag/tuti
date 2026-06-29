# CSS Revamp Phase 6 — Purchase Flow Consolidation and Checkout Experience Enhancement

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
 M apps/web/src/features/pages/ProductDetailPage.jsx
 M apps/web/src/features/reviews/ReviewContributionPanel.jsx
 M apps/web/src/features/storefront/StorefrontPage.jsx
 D apps/web/src/features/storefront/components/CommerceHeader.jsx
 D apps/web/src/features/storefront/components/HeroShowcase.jsx
 M apps/web/src/styles/client.css
MM apps/web/src/styles/storefront.css
 M apps/web/vite.config.js
 M docs/bmad/D0.1-design-quality-checklist.md
 M docs/bmad/D0.2-screen-audit-reports.md
A  docs/design/css-revamp-phase-1.md
 M packages/shared/components/PanelHeader.jsx
M  packages/shared/styles/tokens.css
?? apps/web/src/features/homepage/GiftingShortcuts.jsx
?? apps/web/src/features/storefront/components/ShopFilterDrawer.jsx
?? apps/web/src/features/storefront/components/ShopToolbar.jsx
?? docs/design/css-revamp-audit.md
?? docs/design/css-revamp-phase-2.md
?? docs/design/css-revamp-phase-3.md
?? docs/design/css-revamp-phase-4.md
?? docs/design/css-revamp-phase-5.md
```

Exactly Phase 5's end state. `storefront.css`, `tokens.css`, and
`css-revamp-phase-1.md` remain staged from before Phase 1.

## A note on one action that exceeded initial scope, and how it was resolved

While investigating the cart's CSS, this phase found
`apps/web/src/features/storefront/components/CartPanel.jsx` — a header
mini-cart component with zero importers anywhere in the codebase. It was
initially deleted on the reasoning that it matched Phase 2's "verified
orphan removal" precedent. The system flagged that this exceeded what was
explicitly authorized: Phase 2 worked from an explicit, user-reviewed list
of named files; this phase was not given one, and the deletion was based on
this phase's own dead-code inference rather than the user's instruction.
The user was asked directly and confirmed: delete it. The rest of this
report proceeds on that basis. This is recorded here, not just in the chat,
so the record of *why* this file is gone survives independently of the
conversation it happened in.

## Task A — Live purchase-flow architecture

- **Cart route**: `/cart` → `App.jsx`'s `getRoute()` maps any `/cart*` path
  to the `"cart"` route → renders `<CartPage>`.
- **Checkout route**: there is no separate `/checkout` route. `CartPage` is
  a re-export of `CartCheckoutPage` (via the `SitemapPages.jsx` barrel) and
  handles both cart review and checkout form submission in one component —
  matching its filename. This is a deliberate single-page design, not a
  missing route.
- **Order confirmation**: `/orders/:orderId` → `"order-confirmation"` route
  → `<OrderConfirmationPage>`, a genuinely separate component and route from
  Cart/Checkout.
- **CartPage.jsx vs CartCheckoutPage.jsx**: `CartPage.jsx` is a one-line
  re-export (`export { CartCheckoutPage as CartPage } from
  "./SitemapPages.jsx"`) — the same deliberate route-facing-alias pattern
  Phases 4–5 already documented for `ShopPage.jsx`/`ProductPage.jsx`.
  `CartCheckoutPage.jsx` is the real implementation.
- **Cart state**: `useCartStore` (zustand + `persist` middleware,
  `localStorage` key `tuti-cart`). `addItem(product, quantity, options)`
  merges into an existing line for the same product unless
  `options.separateLine` is set; `updateQuantity(lineId, quantity)` treats
  any value ≤ 0 as a removal.
- **Quantity representation**: a plain integer per cart line
  (`item.quantity`), no separate variant/SKU dimension (consistent with
  Phase 5's finding that the product schema has no real variant data).
- **Seller/shop grouping**: cart lines carry `shopId` but the cart/checkout
  UI does not currently group or sub-total by seller — confirmed by reading
  the render logic; not something this phase added or removed.
- **Delivery info**: captured as plain form fields (`deliveryDate`,
  `deliveryTime`, `deliveryAddress`) submitted with the order; no address-
  book or saved-address feature exists.
- **Gift message/personalisation**: captured at two levels — an order-level
  `giftMessage`/`notes` pair in the checkout form, and, separately,
  per-line-item `metadata` (`cakeWriting`, `allergyNote`, `itemMessage`,
  `giftWrap`) entered directly on each cart line in the order summary,
  persisted via `updateItemMetadata`. Both are real, both were preserved
  exactly as found.
- **Payment method**: `cod` (Cash on Delivery) is the only selectable
  option; `card` renders as a visibly disabled placeholder ("Secure
  checkout — Payment options are shown at checkout") rather than a fake
  interactive card form. This was already correct and is unchanged.
- **Order creation**: `placeOrder()` calls `ordersApi.create(payload,
  idempotencyKey)` → `POST /orders` with an `Idempotency-Key` header
  generated once per submit attempt and reused on retry. This is a real,
  working, already-correctly-built integration — not a placeholder.
- **Confirmation data**: `OrderConfirmationPage` reads the order ID from the
  URL path itself (`/orders/:id`) and an optional guest token from
  `sessionStorage` (written by `CartCheckoutPage` immediately after a
  successful guest order), then calls `ordersApi.get(orderId, guestToken)`
  independently — it does not receive order data as a prop from the
  checkout step. This means a guest can safely refresh, bookmark, or share
  the confirmation URL without losing access (as long as they still have
  the token), and an authenticated customer can simply revisit `/orders/:id`
  later.
- **Refresh behaviour** (verified live):
  - **Cart**: refreshing `/cart` re-hydrates from `localStorage` — items
    persist exactly as left.
  - **Checkout form**: typed-but-unsubmitted form field values do **not**
    persist across a refresh (the form is local `useState`, not persisted)
    — this is standard, expected behaviour for an in-progress form, not a
    bug; the cart contents themselves still survive.
  - **Confirmation**: refreshing `/orders/:id` correctly re-fetches and
    re-renders the same order (verified live with a real placed order,
    including after a hard reload).

## Task B — Data and pricing verification (security-critical)

This was the most important verification in this phase, given the explicit
security requirements in the brief.

- **Authoritative pricing is server-side, already correctly built.**
  Traced `POST /orders` → `orders.service.js`: `normalizeCheckoutPayload()`
  calls `loadCheckoutProducts()` (fetches the *real* product records from
  the database by ID) and rewrites every submitted item via
  `canonicalProductOrderItem(item, product)`, which sets `price:
  Number(product.price || 0)` — **entirely from the server's own product
  record, never from whatever price the client happened to submit.** The
  only client-supplied field that survives into the canonical item is
  `quantity`, which is the one field a customer is legitimately allowed to
  choose. `makeOrderFromPayload()`'s `subtotal = payload.items.reduce(...
  item.price ...)` then sums these already-canonical, already-server-
  verified prices — it is not trusting client input despite reading
  `item.price` at that point in the code.
- **Seller/shop ownership is not client-trusted** — `shopId` on each
  canonical item also comes from the looked-up `product` record, not the
  client payload.
- **No client-authoritative pricing was introduced by this phase.** The
  cart's displayed `cartTotal` (shown in `.checkout-summary-card`) is a
  client-side preview computed from the same product data the cart already
  cached — it is informational only and is superseded by the backend's own
  computation at order-creation time, which was true before this phase and
  remains true now. This phase did not add, remove, or change any pricing
  calculation, client or server.
- **Existing architecture debt, documented rather than touched or
  invented**: there is no real delivery-fee calculation anywhere in this
  flow today. The checkout summary's "Delivery" row shows descriptive text
  ("Choose a slot" / "Saved with your account"), never a fee amount, and
  the order confirmation's totals row computes "Total" from the same
  `order.subtotal` as "Items" — they are always numerically identical. This
  was true before this phase. No fake delivery fee was invented to fill
  this gap, per the brief's explicit instruction; it is recorded here as
  pre-existing debt for a future phase to address at the backend level.
- **Internal/private fields are not exposed.** `OrderConfirmationPage`
  shows `order.status` via a `StatusBadge` component (not a raw internal
  enum string rendered directly), and its "not found"/"unauthorized"/
  "error" states use plain customer-facing language with zero stack traces
  or internal status names — confirmed by reading every branch.

## Task C — Selector ownership map

| Area | Selectors (representative) | Location | Classification |
|---|---|---|---|
| Checkout layout | `.checkout-layout` | storefront.css (split: shared width/margin shell at one location, own grid properties at another — verified non-conflicting, not a duplicate, left as-is) | Checkout-owned |
| Cart line items (shell) | `.cart-items`, `.cart-item` (+`strong`/`span`) | storefront.css, in a shared "list row" compound also used by `.rank-row`/`.approval-row`/`.compact-row` etc. | **Shared utility** — intentionally not extracted; used by non-purchase-flow list UIs too |
| Cart line items (new) | `.cart-item-actions`, `.cart-quantity`(+`-btn`/`-value`), `.cart-remove-btn` | storefront.css (new, Phase 6) | Cart-owned |
| Checkout forms | `.checkout-form-panel`, `.checkout-choice-grid`(+`-choice`), `.checkout-card-heading`, `.checkout-form-grid`(+`-field-wide`), `.checkout-auth-helper`, `.checkout-login-link` | storefront.css | Checkout-owned |
| Delivery & gifting fields | (rendered with `.checkout-form-grid`'s shared `label`/`input`/`textarea` styling — no dedicated selectors) | storefront.css | Checkout-owned |
| Payment | `.payment-method-grid`, `.payment-method` (shares its base rule with `.checkout-choice` — both are "selectable card" controls, verified intentional, not a duplicate) | storefront.css | Checkout-owned |
| Order summary | `.checkout-summary-card`, `.checkout-box`, `.summary-line` | storefront.css (`.checkout-box`/`.summary-line` shared with the now-deleted `CartPanel.jsx` — `CartCheckoutPage.jsx` is the sole remaining consumer) | Checkout-owned |
| Per-item metadata/config display | `.checkout-item-facts`, `.checkout-item-configuration-summary`, `.checkout-item-metadata-summary`, `.checkout-item-metadata-fields`, `.checkout-item-checkbox` | storefront.css | Checkout-owned |
| Empty/validation states | `.checkout-error` | storefront.css | Checkout-owned. The empty-cart state (new, Phase 6) reuses the shared `PageHero` + `.sitemap-hero-actions` rather than introducing a new selector family |
| Order confirmation | `.order-confirmation-panel`(+`-header`/`-meta`/`-note`/`-items`/`-totals`/`-actions`(new)/`-subnote`(new)) | storefront.css, several comma-grouped with `.account-order-*` | Confirmation-owned, but **intentionally shared** with the Account page's order-history display — grouping noted, not changed (Account pages are out of scope) |
| Delivery timeline | `.account-order-timeline`(+`-list`/`-step`) | storefront.css | Shared with Account order history — same as above |
| Dead, removed this phase | `.checkout-steps`, `.checkout-step-card`, `.mini-cart-*`, `.quantity-tools` | storefront.css | **Dead — removed** (see Task D) |
| Shared product-card (related items, if any) | n/a this phase — neither Cart nor Checkout renders product-card rails | — | — |

A repo-wide check confirmed no purchase-flow-exclusive selector exists in
`homepage.css`, `immersive.css`, or `base.css`. `client.css` defines
`.sitemap-hero-actions` with a different `margin-top` than the same
selector in `storefront.css` — a real cross-file duplicate, but
`.sitemap-hero-actions` is shared infrastructure used by many unrelated
sitemap pages (Legal, Journal, Gifting, etc.), not purchase-flow-exclusive,
so per this phase's scope ("client.css, only if a purchase-flow rule
incorrectly lives there") it was left untouched and is simply noted here.

## Task D — CSS consolidation performed

**Removed (dead, zero JSX consumers, confirmed via grep for static imports,
dynamic imports, string references, and tests):**
- `apps/web/src/features/storefront/components/CartPanel.jsx` (user-
  confirmed deletion — see the note above).
- `.mini-cart-configuration`(+`em`), `.mini-cart-metadata`(+`em`),
  `.mini-cart-copy`, `.mini-cart-line-head`(+`strong`/`span`),
  `.mini-cart-qty`, `.quantity-tools`(+`.icon-button`) — exclusively owned
  by the deleted component.
- `.checkout-steps`, `.checkout-step-card`(+`span`/`h2`/`p`) — zero JSX
  consumers (`CartCheckoutPage.jsx` uses `.checkout-form-card` for its
  numbered sections, never `.checkout-step-card`). Phase 2 found this same
  dead selector and explicitly deferred deleting it only because it shared
  a rule with the live `.checkout-summary-card`; that entanglement is what
  this phase resolves (below).

**Merged (real duplicates, effective computed style preserved):**
- `.checkout-card-heading, .order-confirmation-header` — was defined twice,
  back-to-back, with the *identical* selector list (one rule had
  `grid-template-columns`/`align-items`, the next had `display`/`gap`) —
  merged into one rule.
- `.checkout-summary-card` — was split across a shared compound with the
  now-dead `.checkout-step-card` plus a standalone override. Consolidated
  into one rule; `.checkout-step-card` removed entirely (not just left as
  an unused comma-member).
- `.order-confirmation-panel` — was split across a shared compound with
  `.checkout-form-card` plus a standalone override. Unlike Phase 5's
  analogous `.detail-shop-card` case (which stayed partially split because
  the shared compound also served out-of-scope pages), **both** selectors
  here are exclusively used within this phase's own primary-scope files
  (`CartCheckoutPage.jsx` and `OrderConfirmationPage.jsx`), so this was
  fully merged into one rule rather than just labeled.

**Fixed (CSS quality, Task K):**
- `.checkout-item-checkbox` used `display: flex !important` and `gap:
  var(--sp-2) !important` to outrank `.checkout-item-metadata-fields label`
  (a higher-specificity class+element selector). Rewrote the selector as
  `label.checkout-item-checkbox` (matching that specificity, and later in
  source order) — removes both `!important`s with no effective style
  change.
- `.checkout-card-heading > span` (the numbered "1"/"2"/"3" circles) used
  `color-mix(in srgb, var(--gold) 62%, white)`. Three of these render
  simultaneously on one screen (Customer details / Delivery / Payment),
  which alongside the page's other content risked exceeding D0.1's "max 2
  gold elements at rest" rule. Changed to `var(--brand-light)`/
  `var(--brand-dark)` — also de-emphasizes the step-numbered look, which
  matters because Task F.1 explicitly warns against "excessive step cards"
  for a flow that (confirmed by reading the code) submits all three
  sections together, not as an actual multi-step wizard.
- Replaced 4 repeated inline `style={{ marginTop: ..., display: "flex",
  gap: ..., flexWrap: "wrap" }}` objects in `OrderConfirmationPage.jsx`
  with one shared `.order-confirmation-actions` class, plus one
  `style={{ marginTop: "0.5rem" }}` with `.order-confirmation-subnote`.
- Removed an unused `formatPaymentMethod` import from `CartCheckoutPage.jsx`
  (the component never called it — pre-existing, found while editing this
  file's import block anyway).

**Verified non-duplicate, left as-is:**
- `.checkout-layout` appears in three places: a shared width/margin shell
  (with `.catalog-hero`/`.catalog-shell`/`.sitemap-hero`), its own
  grid-template/gap rule, and two canonical-breakpoint responsive overrides
  shared with several unrelated page layouts. No two locations set the same
  property — this is a correctly-split, intentional architecture, not
  duplication.
- `.checkout-auth-helper`'s border-color is subtly overridden by a shared
  8-member "chip utility" compound (`.notification-badge`,
  `.cake-meta-chip`, `.footer-payment-chip`, etc.) — this is the exact same
  entanglement Phase 2's audit already documented and explicitly left
  untouched; this phase made the same call for the same reason.

## Task E — Cart visual and UX enhancement

**Cart line items** — each row already showed product art, name, price,
quantity, and (for cake/gift items) inline metadata fields; that content
was preserved exactly. What was missing and is now fixed: a real quantity
control. Previously, the only control on each line was a single button
showing "−" with `onClick={() => updateCartQuantity(lineKey, -1)}` — since
`cartStore.updateQuantity` treats any value ≤ 0 as "remove this line
entirely," this button always removed the whole item, regardless of its
current quantity, despite visually reading like a decrement-by-one control.
Replaced with a real stepper (`.cart-quantity`: decrement, live quantity
value, increment — decrement passes `item.quantity - 1`, so it only removes
the line once quantity would drop to zero, matching what the control now
visually promises) plus a separate, explicitly-labeled remove button
(`Trash2` icon, danger-toned, `aria-label="Remove {name} from cart"`).
Verified live: quantity changes correctly persist to `localStorage`,
removal works, no duplicate interactive destinations.

**Empty cart state** — previously, visiting `/cart` with zero items
rendered the **entire checkout form** (customer details, delivery, gift
message, payment method) above a one-line "Your cart is empty." buried
inside the order-summary aside — inviting the user to fill in delivery
details for nothing to deliver. Added an early return: when `cart.length
=== 0`, render the shared `PageHero` with the brief's exact suggested
heading ("Your cart is ready for something thoughtful."), a short
explanation, and two actions — "Browse the shop" (primary) and "Build a
box" (secondary, via the existing `/build-a-box` route). This reuses
existing shared component/CSS (`PageHero`, `.sitemap-hero-actions`) rather
than introducing new markup, and the now-unreachable `cart.length ? ... :
<p>Your cart is empty.</p>` ternary inside the summary aside was simplified
to a plain `cart.map(...)` (the empty case can no longer reach that code).

## Task F — Checkout visual and UX enhancement

The existing layout (main form column + sticky order-summary aside on
desktop, stacked on mobile via the canonical 1180px breakpoint) already
matched the brief's structural ask and was not restructured. Visual
changes made:
- De-emphasized the gold numbered-circle treatment on the three form
  sections (Task D) — calmer, and reduces the "is this a wizard?" signal
  for a flow that isn't actually step-gated.
- Forms: labels, required-field marking, consistent field height/radius/
  focus-ring, and 375px stacking were all already correct — verified live
  (native HTML5 `required` validation correctly blocks submission and
  marks the first invalid field; confirmed via `element.validity` after
  attempting to submit with empty fields).
- Payment method: confirmed the disabled "Secure checkout" card placeholder
  is genuinely non-interactive (`disabled` attribute, not just styled to
  look disabled) and carries no false "your card is safe" copy — it
  explicitly says payment options are "shown at checkout," not promising a
  capability that doesn't exist yet.
- Order summary: subtotal, item count (via the per-line list itself),
  and the existing "Delivery" text-only row were preserved; no fee or
  discount was invented (Task B).

## Task G — Order confirmation

Already comprehensive before this phase — order reference, status badge,
payment method/status, customer/delivery details, gift message/notes when
present, itemized list, totals, a 10-state delivery timeline
(`OrderStatusTimeline`, shared with the Account page), a "What happens
next" list that adapts its wording to the actual payment method and
delivery-date presence, and Continue Shopping / My Orders actions. This
phase's only change here was the inline-style cleanup (Task D) — the
content and structure were already strong and were not redesigned.

## Task H — States

**Loading**: not redesigned, per the brief's explicit instruction.
Documenting precisely, matching the identical finding already recorded for
Shop (Phase 4) and Product Detail (Phase 5): `App.jsx` gates the entire
router on one global `loading` flag before any route — including Cart and
Checkout — mounts. `OrderConfirmationPage` has its *own*, separate,
already-existing local loading state (`status: "loading"`) for the
order-fetch itself, which is unaffected by and unrelated to the global
router-level loading gate.

**Error**: the global router-level error architecture (`.cl-error`,
`role="alert"`, Retry button) is unchanged. For checkout submission
errors specifically, the existing, already-correct behaviour was verified,
not rebuilt: `mapCheckoutError()` translates backend messages into
customer-friendly text with no stack details; the cart and form field
values are untouched on failure (only cleared on confirmed success, after
`ordersApi.create` resolves); the idempotency key is retained across a
failed attempt and only reset after success, so a retry cannot create a
duplicate order.

**Validation**: native HTML5 `required`/`type="email"` validation on every
checkout field, confirmed live to block submission and mark the invalid
field. This is unchanged from before this phase — already a correct,
accessible pattern (browser-native invalid-field messaging is well
supported by assistive technology) and was not replaced with custom
validation.

## Task I — Accessibility

Verified live (Playwright) and by direct code reading on the Cart/Checkout
page:
- Exactly one `<h1>` (confirmed both for the empty-cart state and the
  populated checkout form).
- Zero duplicate `id` attributes.
- Zero headings nested inside buttons.
- Zero `<svg>` elements without `aria-hidden="true"` inside `<main>`
  (checked programmatically — the pre-existing icons already had it; the
  new quantity/remove icons were added with it from the start).
- New quantity stepper: wrapped in `role="group" aria-label="Quantity for
  {item name}"`, each button has its own descriptive `aria-label`, the
  live value has `aria-live="polite"`.
- New remove button: `aria-label="Remove {item name} from cart"`.
- **Touch target gap found and fixed before reporting**: the first version
  of `.cart-quantity-btn`/`.cart-remove-btn` used `2.2rem` (35px), copying
  the now-deleted `CartPanel.jsx`'s old sizing rather than the
  44px-minimum convention already established in Phases 1–5. Corrected to
  `2.75rem` (44px) and confirmed live via `getBoundingClientRect()` before
  concluding this task — the same mistake (and the same fix) as Phase 5's
  quantity stepper, caught proactively this time rather than via a separate
  test pass.
- Payment method and checkout-identity controls already exposed
  `aria-checked`/`aria-pressed` correctly (pre-existing, verified, not
  rebuilt) and the disabled "Secure checkout" option is a real `disabled`
  button, not a styled-to-look-disabled one.
- `:focus-visible` confirmed functional on the Cart/Checkout page.
- No keyboard trap — the only modal-like surface anywhere in this flow is
  the (unrelated, untouched) cookie-consent banner.

## Task J — Responsive results

Verified live and via screenshots at all four required widths on `/cart`:

| Width | Overflow | Console errors |
|---|---|---|
| 375px | 0px | 0 |
| 768px | 0px | 0 |
| 1280px | 0px | 0 |
| 1440px | 0px | 0 |

At 375px: the new cart-item quantity stepper and remove button stack
cleanly below the product copy (via `.cart-item-actions`'s
`flex-direction: column`) rather than competing for horizontal space; the
checkout form fields stack to one column at the existing canonical 820px
breakpoint (unchanged); the order summary remains directly reachable by
scrolling, with no sticky element covering it. At desktop, the
sticky-positioned summary column (`.checkout-summary-card`) and the form
column remain balanced, consistent with the unmodified `.checkout-layout`
grid. Confirmed the order-confirmation page's `.order-confirmation-meta`
3-column grid correctly collapses to 1 column at the canonical ≤820px
breakpoint (pre-existing, re-verified).

## Task K — CSS quality

- Canonical tokens used throughout every new/touched rule
  (`var(--brand-dark)`, `var(--brand-light)`, `var(--paper)`, `var(--line)`,
  `var(--ink)`, `var(--sand)` — the last one pre-existing-and-undefined,
  not newly introduced, consistent with every prior phase's deferral of the
  eight unresolved variables).
- Two `!important` usages removed (`.checkout-item-checkbox`); the
  unrelated, pre-existing `.gift-price { color: ... !important; }` (Shop
  card pricing, not purchase-flow) and the two `!important`s inside the
  now-deleted `.mini-cart-configuration`/`.mini-cart-metadata` (removed as
  part of deleting that dead code, not specifically hunted) were the only
  other instances found in scope.
- No new one-off breakpoint was introduced; the new quantity-stepper CSS
  and empty-cart state use no breakpoints at all (their layouts are
  intrinsically responsive via flexbox), and the inherited
  `.checkout-layout`/`.order-confirmation-meta` breakpoints (1180px, 820px)
  were left exactly as they were.
- `.sitemap-hero-actions`'s cross-file duplicate (storefront.css vs.
  client.css, different `margin-top`) was found and documented (Task C)
  but not touched — not purchase-flow-exclusive, out of this phase's scope
  for `client.css` edits.
- No selector touched this phase went deeper than necessary; the highest-
  specificity selector introduced (`label.checkout-item-checkbox`) was
  deliberately raised only enough to remove an `!important`, not further.

## Lines and bundle size

| Metric | Before Phase 6 | After Phase 6 | Change |
|---|---|---|---|
| `storefront.css` lines | 10,349 | 10,355 | +6 (net: removed ~95 lines of dead CSS and merged duplicates, added ~100 lines of new functional CSS + ownership comments) |
| `CartCheckoutPage.jsx` lines | 351 | 399 | +48 (empty-cart state, quantity stepper + remove button, minus one simplified ternary and one unused import) |
| `OrderConfirmationPage.jsx` lines | 245 | 245 | 0 (inline styles swapped 1:1 for className strings) |
| `CartPanel.jsx` | 105 | deleted | −105 (confirmed dead, user-confirmed deletion) |
| Customer web CSS bundle (raw) | 235.99 kB | 235.30 kB | **−0.69 kB** despite added functionality — the dead-code removal outweighed the new CSS |
| Customer web CSS bundle (gzip) | 41.17 kB | 40.97 kB | −0.20 kB |
| Seller / Admin / Driver / SR bundles | unchanged | unchanged | 0 bytes (no file outside `apps/web` touched this phase) |

## Verification

- `git diff --check` — clean.
- `npm run test:critical-smoke` — 5/5 pass, including **"checkout authority
  and COD-only checkout"** specifically — the highest-stakes smoke test for
  this phase, confirmed passing since no backend logic was touched.
- `npm run build` — all five workspaces build clean.
- One build break was introduced and caught during this phase: an added
  ownership comment's own prose contained the literal substring
  `-*/.account-order-*`, which CSS parses as closing the comment early,
  corrupting everything until the next real `*/`. Caught immediately by
  the build failing (lightningcss: "Unexpected end of input"), root-caused
  by scanning the file for unbalanced `/*`/`*/` pairs, fixed by rewording
  the comment, confirmed via a balance check and a clean rebuild before
  continuing. Recorded here in the interest of an accurate report, not
  glossed over.
- Functional, live-browser checks: empty cart renders with the correct
  heading; product added from Product Detail appears in cart; quantity
  increments/decrements and persists to `localStorage`; item removal
  works; checkout form blocks submission on missing required fields
  (native validation, confirmed via `element.validity`); a real order was
  placed end-to-end (`ordersApi.create` → `/orders/ORD-...` →
  `OrderConfirmationPage` rendering the correct reference, items, and
  totals) at both desktop and mobile widths; payment method selection
  works and the disabled card option stays genuinely non-interactive;
  browser refresh on Cart (items persist) and on Order Confirmation (order
  re-fetches and re-renders identically) both verified; Home, Shop (13
  cards, unaffected), and Product Detail all confirmed unaffected with 0
  console errors and 0px overflow.
- Visual checks captured and reviewed at 375/768/1280/1440px for the
  empty cart, populated cart with the new stepper, checkout form, and
  order confirmation (desktop and mobile).
- Accessibility checks: one `<h1>`, zero duplicate IDs, zero headings
  inside buttons, zero unmarked decorative icons, `:focus-visible`
  functional, 44px touch targets confirmed (after the proactive fix above).

## Pre-existing work preserved

All pre-flight items are present and unchanged after this phase. Phase 6's
own changes: `CartCheckoutPage.jsx`, `OrderConfirmationPage.jsx`, and
`storefront.css` modified; `CartPanel.jsx` deleted (user-confirmed); this
document added.

## Remaining purchase-flow debt

- **No real delivery fee anywhere in the flow** (Task B) — "Total" is
  always numerically identical to "Items" subtotal, both client-side
  (checkout summary) and server-side (`order.subtotal` used for both
  fields on the confirmation page). This is the single largest piece of
  pre-existing debt this phase surfaced; fixing it requires backend work
  (a real fee calculation, stored on the order), which is out of scope
  here.
- **Loading/error states remain app-wide** — same architectural gap
  already documented for Shop and Product Detail, now confirmed identical
  for Cart/Checkout too.
- `.checkout-layout`'s shared width/margin shell and `.checkout-auth-
  helper`'s chip-utility entanglement are correctly left in their existing
  shared compounds (Task D) — not debt exactly, but worth knowing they're
  intentionally not "fully owned" by this phase's section.
- `.sitemap-hero-actions`'s cross-file duplicate (storefront.css vs.
  client.css) is real but not purchase-flow-exclusive — left for whichever
  future phase covers the shared sitemap-page infrastructure.
- Seller/shop grouping in the cart UI doesn't exist (each line is shown
  independently regardless of which seller it's from) — not a defect
  relative to anything this phase was asked to build, just noted as a
  capability that isn't there if a future phase wants it.

## Recommendation for Phase 7

1. If a real delivery fee is ever introduced, it should be computed and
   stored server-side (same authority model already correctly used for
   item pricing) and surfaced through the existing "Delivery" row/field
   rather than requiring new UI.
2. Apply this phase's verification rigor (live order placement, not just
   static reading) to the Account page's order-history view next — it
   shares `.account-order-*`/`.order-confirmation-*` CSS and the same
   `OrderStatusTimeline` component with Order Confirmation, but per this
   phase's scope restriction ("do not modify account pages") it was read
   only enough to confirm the sharing, not audited in its own right.
3. Low-priority: resolve the `.sitemap-hero-actions` cross-file duplicate
   if a future phase takes on the shared sitemap-page CSS as its own
   subject (Legal/Journal/Gifting/Offers/etc.), the same way this phase
   resolved `.checkout-card-heading`'s analogous duplicate.
