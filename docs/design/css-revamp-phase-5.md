# CSS Revamp Phase 5 — Product Detail Consolidation and Experience Enhancement

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
?? docs/design/css-revamp-phase-4.md
```

Exactly Phase 4's end state. `storefront.css`, `tokens.css`, and
`css-revamp-phase-1.md` remain staged from before Phase 1 — untouched by
this phase's own actions.

## Task A — Live component architecture

- `apps/web/src/features/pages/ProductPage.jsx` is a **one-line re-export**:
  `export { ProductDetailPage as ProductPage } from "./ProductDetailPage.jsx"`
  — the same deliberate route-facing-alias pattern already documented for
  `ShopPage.jsx` in Phase 4. It is the only consumer of `ProductDetailPage`,
  and `App.jsx` imports `ProductPage`, not `ProductDetailPage` directly.
- `ProductDetailPage.jsx` (601 lines after this phase) is the real
  implementation — confirmed by reading it in full and finding no other
  file that renders product-detail markup.
- **Route**: `App.jsx`'s router maps any path starting with `/products/`
  to the `"product"` route (`getRoute()`), which renders `<ProductPage
  product={productDetail} products={products} ... />`.
- **Imports/consumers**: `grep -rn "ProductDetailPage\|ProductPage"` across
  `apps/web/src` found exactly two references — the re-export and the
  `App.jsx` import. No dynamic imports, no barrel exports, no string-based
  registries, no test files reference either name.
- **Product-card navigation targets**: `ProductCard`/`CakeCard`/
  `GiftBoxCard` (via `ProductCardRouter`) all call `onViewProduct(product.id)`
  → `goToProduct(productId)` in `App.jsx` → `push("/products/" + productId)`
  → same route. Verified live: clicking a Shop card, a homepage rail card,
  and a related-product card on the detail page itself all land on
  `/products/:id` and render correctly.
- **Direct URL load / refresh**: confirmed live — navigating straight to
  `/products/prf-004` (no prior in-app navigation) and reloading an
  already-open product page both render the correct product with no error.

`ProductPage.jsx` is a deliberate, stable alias and was preserved exactly
as found — not touched, not removed.

## Task B — Data and pricing path

- `productDetail = products.find((p) => p.id === getProductId())` in
  `App.jsx`. `products` comes from `storefront.products`, which is the
  same `marketplaceApi.getStorefront()` response Phase 4 already verified
  live returns **only `status: "Live"` products** — the backend's
  `sanitizePublicProduct` is the enforcement point.
- Because `products` can never contain a non-Live record in the first
  place, `.find()` against any draft/hidden/archived/suspended product ID
  — or any ID that never existed — returns `undefined` exactly the same
  way. `ProductDetailPage` renders the not-found state whenever `product`
  is falsy. Verified live: a nonexistent product ID renders "Product not
  found" with zero stack information and a working "Back to shop" action.
- **Eligibility enforcement is server-side only** for this page (unlike
  Shop, which also re-filters `status === "Live"` client-side as
  redundant defense-in-depth — Phase 4). Product Detail doesn't need its
  own client-side re-filter because the lookup set it draws from
  (`products`) is already exclusively server-filtered; adding a second
  client-side check here would be redundant, not a real additional
  boundary, so none was added.
- **Price/discount/stock source**: `product.price`, `product.originalPrice`,
  `product.stock` are read directly from the server-provided product
  object and rendered as-is — nothing is computed or overridden
  client-side. `formatCurrency()` only formats for display.
- **No client-calculated authoritative price was introduced.** The new
  quantity stepper changes how many units are requested
  (`onAddToCart(product, quantity)`), not the unit price; the cart store's
  `total()` getter (`packages/shared` — used unmodified) multiplies
  `price * quantity` for display purposes only. Checkout-time price
  authority is unchanged and untouched by this phase.
- **No client-supplied seller/shop ownership is trusted.** `shop =
  getShop(product.shopId)` looks up shop metadata (name, city, story) for
  *display* only — it does not gate visibility or pricing.
- **Type handling**: `getProductType(product)` reads `product.category`
  directly (`perfume` / `cake` / `dessert` / `gift_box` / `bundle`) — no
  client-side type inference beyond that one field.
- **Options/variants**: the live product schema (confirmed against the
  running API for one example of each category) is a single flat object
  per product — `size`, `flavors`, `cakeType`, etc. are all plain
  strings/arrays describing *that one SKU*, not arrays of selectable
  variants with their own prices. There is no `sizes[]`, `variants[]`, or
  equivalent anywhere in the data. See Task E.5 for what this means for
  option rendering.
- **Related-product source**: computed client-side from the same already-
  fetched, already-Live-filtered `products` array (by shared family/
  shopId/category) — no separate fetch, no separate trust boundary.

## Task C — Selector ownership map

A repo-wide search (`storefront.css`, `client.css`, `homepage.css`,
`immersive.css`, `base.css`) found Product Detail CSS living in exactly
two files, unlike Shop's single-file home in Phase 4:

| Area | Selectors (representative) | Location | Classification |
|---|---|---|---|
| Page shell | `.page-shell` | storefront.css | Shared utility (also used by other simple pages) |
| Breadcrumb/back | `.page-back` | client.css | Product-detail-owned |
| Main layout | `.product-detail-layout` (was also `-wide`, removed — see Task D) | storefront.css (was also client.css) | Product-detail-owned — **had a real cross-file conflict, fixed** |
| Media gallery | `.product-gallery-panel`, `.detail-uploaded-img(+img)`, `.detail-cake-art`, `.detail-gift-art` (+layer/lid/body/ribbon/plate/candle parts) | storefront.css | Product-detail-owned |
| Product info/pricing | `.product-detail-main`, `.product-detail-kicker`, `.detail-subhead-row(+span)`, `.detail-shop-link`, `.detail-price`, `.detail-rating-row` | storefront.css | Product-detail-owned |
| Options/quantity | `.detail-quantity(+btn/-value)` — **new this phase** | storefront.css | Product-detail-owned |
| Actions | `.detail-actions` | storefront.css | Product-detail-owned (uses shared `.primary-action`/`.secondary-action`/`.icon-button` for the buttons themselves) |
| Trust strip / tags | `.detail-trust-strip(+span/svg)`, `.detail-tags(+span)` | storefront.css | Product-detail-owned |
| Seller card | `.detail-shop-card`, `.detail-seller-avatar`, `.detail-seller-name-row`, `.detail-seller-story`, `.detail-seller-trust`, `.detail-seller-link` | storefront.css | Product-detail-owned — **was scattered across 4 rule locations, consolidated** |
| Specs/notes/description | `.detail-info-grid(+card)`, `.note-list-row`, `.note-row(+--top/--heart/--base/-label)`, `.note-chips(+chip/--flat)`, `.detail-spec-grid`, `.detail-check-list`, `.detail-muted`, `.detail-section` | storefront.css | Product-detail-owned |
| Reviews | `.detail-review-section`, `.review-panel`, `.review-target`, `.review-form`, `.review-range`, `.review-list(+card/-empty)` | storefront.css | Product-detail-owned (component has exactly one consumer — `ProductDetailPage` — confirmed by grep) |
| Related products | `.collection-section`, `.section-heading`, `.collection-grid` | storefront.css | Shared utility (used by Collections-style pages too — left untouched) |
| Not-found state | `.not-found-panel` | storefront.css | Shared utility (shared background/border/shadow with `.origin-card`/`.collection-page-card`/etc. — untouched) |
| Sticky action bar | `.detail-sticky-bar(+copy/-name/-price)` | storefront.css | Product-detail-owned — **was activated at the wrong breakpoint, fixed** |
| Shared product-card (related/pairing rails) | `.product-card`, `.cake-card`, `.gift-card`, `.catalog-card-*` | storefront.css | Shared product-card (Phase 4 territory) — untouched |

No selector was found in `homepage.css`, `immersive.css`, or `base.css`.

### Methodology note

Several selectors had high comma/descendant occurrence counts (`.detail-
shop-card` ×6, `.detail-trust-strip` ×6, `.detail-cake-layer` ×5) that
looked like duplication at a glance. Reading full context resolved each
one: `.detail-cake-layer`'s 5 occurrences are a base rule plus three
`.bottom`/`.middle`/`.top` tier modifiers plus nothing else — not a
duplicate. `.detail-trust-strip`'s occurrences are a base rule, a
`span`/`svg` descendant rule, and one genuine responsive override (now
relocated, see Task D) — not a duplicate. `.detail-shop-card`, by
contrast, **was** a real duplication problem and is detailed below.

## Task D — CSS consolidation performed

Three genuine problems were found and fixed, in order of severity.

### 1. `.product-detail-layout-wide` — cross-file conflict that broke mobile (critical)

The element always rendered with **both** `product-detail-layout` and
`product-detail-layout-wide` classes (confirmed the only JSX usage). Three
definitions existed for the column template:

- `storefront.css` base `.product-detail-layout` — 3 columns
- `storefront.css` `.product-detail-layout-wide` — different 3 columns
- `client.css` `.product-detail-layout-wide` — entirely different, **2
  columns, unconditional** (no media query)

Because `client.css` loads after `storefront.css` in the real bundle
(established cascade order, `css-revamp-audit.md`), client.css's version
always won for `grid-template-columns` — including under the existing
1180px/820px responsive overrides in storefront.css, because those overrides
target the *base* class while client.css's unconditional rule targets the
`-wide` modifier at equal specificity but later source position, so it won
regardless of viewport. **Verified live at 375px before the fix**: computed
`grid-template-columns` was `138.969px 188.031px` — two cramped, half-
broken columns on a phone screen, with the gallery image squeezed to ~139px
and all product info (title, price, actions, trust strip, seller card)
squeezed into ~188px. Screenshotted for the record; this was almost
certainly invisible to anyone testing only at desktop width.

**Fix**: consolidated into one responsive `.product-detail-layout`
definition in `storefront.css`:
- Base (desktop): 2 columns (`minmax(0,0.85fr) minmax(0,1.15fr)`), gallery
  spans the full row height of column 1, `.product-detail-main` and
  `.detail-shop-card` both sit in column 2 (stacked).
- ≤820px (existing shared compound, now actually effective for this
  selector for the first time): collapses to 1 column; a new explicit
  reset returns the gallery to `position: static; grid-row: auto` and the
  main/shop-card to `grid-column: 1`, so neither tries to occupy an
  implicit second track that no longer exists — without this reset the
  same class of bug would have reappeared in a different form.
- Removed `.product-detail-layout-wide` entirely from both files; removed
  the now-redundant `grid-column: 1 / -1` override on bare
  `.product-detail-main` inside the 1180px block (it was already
  unreachable dead code once the new descendant-selector rule, which has
  higher specificity, was added — removed rather than left as confusing
  dead weight).
- Removed `product-detail-layout-wide` from the JSX `className` in
  `ProductDetailPage.jsx` (the only consumer).

**Verified live after the fix**: 375px → 1 explicit column (343px,
edge‑to‑edge); 768px → 1 column; 1280px/1440px → 2 columns. The previously-
empty gap beside the seller card on wide desktop (caused by the 3rd grid
item wrapping to its own mostly-empty row under the old 2-column `-wide`
template) is also gone — the seller card now sits directly under the main
info panel as intended.

### 2. `.detail-shop-card` — scattered across 4 rule locations

Beyond the shared "simple card shell" compound it intentionally still
shares with `.origin-card`/`.collection-page-card`/`.shop-profile-card`/etc.
(left untouched — shared with Collections/About/Shop-profile, out of
scope), `.detail-shop-card` had its background/border/shadow/layout split
across three *additional* locations inside the product-detail block
itself: one compound with `.product-gallery-panel`/`.product-detail-main`
for shell visuals, a second compound with `.product-detail-main` for
grid/padding, and a third standalone rule overriding just its background
gradient and border color. Consolidated into one standalone rule with the
exact same effective computed style; removed `.detail-shop-card` from the
two compounds it no longer needs to be part of.

### 3. Sticky action bar — wrong breakpoint, shared with an unrelated page

`.detail-sticky-bar`'s `display: flex` (i.e., the rule that actually makes
it visible) and the related mobile compacting rules for `.detail-trust-
strip`/`.detail-tags`/`.detail-shop-link` lived inside a one-off `@media
(max-width: 700px)` block shared with **Gifting-page** rules
(`.gifting-payment-strip`, `.gifting-build-box-card`, etc.) — completely
unrelated to Product Detail. Since `.product-detail-layout` itself
collapses to one column at the canonical 820px breakpoint, there was a
700–820px gap where the layout was already single-column (so the primary
action could scroll out of view) but the sticky bar had not yet appeared.
Moved all Product Detail rules out of the shared 700px block into the
existing canonical 820px block (alongside other Product Detail mobile
rules already there), leaving the Gifting-only rules in place at 700px
untouched. The sticky bar now activates at exactly the breakpoint where it
becomes useful.

No other genuine duplicates were found. Nothing was deleted purely to
reduce file size — every change above preserves the effective computed
style except where the previous "effective" style was the bug itself.

## Task E — Visual enhancement

**1. Navigation context** — the existing `.page-back` "← Back to
[category]" button was kept as-is; it satisfies the brief's "restrained
breadcrumb **or** back action" framing, is keyboard-operable (a real
`<button>`), and doesn't expose internal category slugs (labels are
human-readable: "Back to perfumes", "Back to cakes", "Back to gift sets").

**2/3. Main layout and media** — see Task D's fix above for the layout;
media itself (`DetailArt`) was already correct and unchanged: stable
`min-height`/`aspect-ratio`-free fixed-height container (no layout shift),
`object-fit` not needed for the uploaded-image case since it uses
`max-width/max-height: 100%; object-fit: contain` correctly, category-aware
fallback art (bottle/cake-tiers/gift-box) when there's no `imagePath`, and
no thumbnail strip — confirmed the product schema has exactly one image
field (`imagePath`, singular) per product, so "thumbnail gallery when
multiple images exist" has no real data to render against. Adding a fake
multi-image carousel would violate the same "no fake options" principle
Task E.5 states explicitly for variants. Documented rather than built.

**4. Product identity** — already complete: name, seller (via `.detail-
shop-link`/seller card), category, price + original-price-only-when-
discounted (`{product.originalPrice ? <del>...` — already conditional),
availability. No changes needed.

**5. Option selection** — confirmed via the live API schema (Task B) that
no product category has real selectable-variant data (no
`sizes[]`/`variants[]`/equivalent; `size`/`flavors`/`cakeType` are fixed
descriptive fields on a single SKU). Per the brief's explicit "render only
options supported by real product data... no fake options," **no option
selectors were added** — there is nothing real to select. What *is* real
and was missing: **quantity**. `cartStore.addItem(product, quantity,
options)` already accepted a quantity parameter, but no quantity control
existed anywhere in the UI and every add-to-cart call hardcoded an implicit
quantity of 1. Added a quantity stepper (`.detail-quantity`) wired into
both "Add to cart" and "Continue order" — verified live end-to-end
(stepper 1→3, clicked Add to cart, confirmed `{"id":"prf-004","quantity":3}`
in the persisted cart store).

**6. Gifting actions** — reordered to match the brief's exact hierarchy.
Before: primary "Add to cart", secondary "Continue order", and a ghost
"Write a review" button that — on inspection — called `onRateProduct
(product.id)`, which `App.jsx` wires to `setSelectedProductId`; since the
page is already showing this exact product, that call was a no-op
self-assignment with no visible effect, and the review form is *already*
permanently visible lower on the page (`ReviewContributionPanel` renders
its full form unconditionally, not behind a trigger). It was a dead button
both functionally and structurally. Removed it (and the now-fully-unused
`onRateProduct` prop destructured at the top of the component) and added a
wishlist/save icon-button in its place, reusing the exact pattern already
shipped in `ProductCard.jsx` (`useWishlistStore`, gated on
`useAuthStore().isAuthenticated()`, same `aria-pressed`/`aria-label`
convention) — this is also what "visually connected to the Shop page"
asks for. Verified live with a real login (seeded `customer@tuti.dev`
account): button hidden when signed out, visible when signed in, toggles
`aria-pressed`/`aria-label` correctly on click and persists via the
existing wishlist API. "Add to gift box" was **not** added — there is no
real integration point: `BuildYourBoxPage` has no mechanism to accept a
preselected product via prop, URL, or navigation call, and building one
would require editing `BuildYourBoxPage.jsx`/`App.jsx`'s routing, neither
of which is in this phase's scope (Build Your Box flow is explicitly
excluded). Per "do not display unsupported actions," it stays out.

**7. Delivery information** — unchanged; `.detail-trust-strip` already
shows "Cash on delivery," "UAE boutique seller," "Seller fulfilled," "Tuti
buyer support," and conditionally "Gift packaging included" — all real,
none invented, no guaranteed-delivery-date promise anywhere.

**8. Seller/boutique information** — unchanged in content (name, location,
story when present, verified-seller badge, link to Shop); only its CSS
ownership was cleaned up (Task D #2). It is a single compact card, not a
card-inside-a-card.

**9. Product details** — unchanged; already organized as separate
`DetailBlock`s (fragrance notes / perfume details, or cake details /
flavor & allergens, or gift-box includes / gift options, plus description
& care for every type) with conditional rendering, not tabs — given the
content per block is short (a handful of spec lines), tabs/accordions
would add interaction cost without reducing scroll length meaningfully, so
the existing flat layout was left as-is.

**10. Reviews** — preserved the existing form and submission rules
entirely untouched. Added the one missing piece: an **empty state**.
`productReviews.slice(0,2).map(...)` previously rendered nothing (not even
a wrapping element) when a product had zero individual review records —
confirmed live on a real product (`cke-001`, which has nonzero aggregate
`reviews`/`verifiedReviews` *counts* but zero individual records in the
sample review dataset — these are different things; the counts are
seeded aggregate stats, the records are a separate, smaller seeded list).
Now renders "Be the first to share your experience with this product."
instead of a blank `<div>`.

**11. Related products** — unchanged; already uses `ProductCardRouter`
(the same card components Shop uses — Phase 4's "shared product-card"),
already excludes the current product (`item.id !== product.id`), already
has a clear `<h2>` heading per section ("Recommended dessert pairing" /
"You may also like"). No outer box around the rail; no duplicate actions
per card (confirmed in Phase 4's accessibility pass, unchanged here). No
carousel arrows exist because the rail isn't horizontally scrollable — it's
a wrapping grid (`.collection-grid`) — which already satisfies "no
duplicate product actions" / "no outer box" without needing arrows.

## Task F — Type-specific presentation

Verified live for one real example of each type (`prf-004` perfume,
`cke-001` cake, `dss-001` dessert, `gft-001` gift set): every `DetailBlock`
that renders for that type has real, non-empty content in every case (no
blank headings, no empty metadata containers) — confirmed programmatically
(`el.children.length > 1` for every `.detail-info-card` on every type) and
visually via full-page screenshots. Conditional rendering (`{isPerfume ?
... : null}` etc.) was already in place and is the only mechanism used;
no placeholder dashes anywhere.

## Task G — States

**Loading**: unchanged, and **not** redesigned, per the brief's explicit
instruction not to touch the global router loading/error architecture.
Documenting the limitation precisely (mirrors Phase 4's identical finding
for Shop): `App.jsx` gates the entire router on one global `loading` flag
before any route — including Product Detail — mounts, so there is no
current way to show a Product-Detail-shaped skeleton without restructuring
how `App.jsx` sequences data-loading relative to routing, which would
affect every route, not just this one. No second, competing page-level
loader was added.

**Not found**: preserved and re-verified live — "Product not found"
heading, single `<h1>`, a real `<button>` "Back to shop" (no stack
information anywhere), correctly navigates to `/shop`. No changes were
made to this state; it already satisfied every requirement.

**Unavailable product**: the data flow does not currently distinguish
*why* a product isn't visible (out-of-stock is the one exception — see
below) — "doesn't exist," "exists but is no longer Live," and "seller/shop
suspended" all collapse to the same `.find()` returning `undefined`
upstream of this page, by server-side design (Task B). Differentiating
these would require the backend to either keep removed products
queryable-with-a-reason or return a distinct signal for "was live, now
isn't" versus "never existed" — that's a backend/API contract change, out
of this phase's scope ("do not invent client-side security rules that
should belong to the backend" cuts the other way too: don't invent
client-side *distinctions* that the backend doesn't actually provide
either). **Out-of-stock** *is* distinguished today and was strengthened
this phase: the primary "Add to cart" button now disables and reads "Out
of stock" when `product.stock === 0` (previously only the sticky bar had
this; the main action button did not — now both are consistent).

**Error**: preserved the current global error architecture exactly as
documented in Phase 4 (`.cl-error`, `role="alert"`, plain-language message,
Retry button, no stack trace) — no Product-Detail-specific retry exists or
was added, consistent with "preserve... unless a safe Product Detail-
specific retry already exists" (none did).

## Task H — Accessibility

Verified live (Playwright) and by direct code reading:
- Exactly one `<h1>` on a product page (the product name) — confirmed via
  DOM query.
- `.page-back` is a real `<button>` with visible, descriptive text (not an
  icon alone).
- Gallery thumbnails: N/A — no thumbnail strip exists (Task E.3 — single
  image per product, confirmed against the live schema).
- Quantity control: wrapped in `role="group" aria-label="Quantity"`, each
  button has its own `aria-label` ("Decrease quantity"/"Increase
  quantity"), the live value has `aria-live="polite"` so changes are
  announced, decrement disables at 1, increment disables at `product.stock`
  when stock is a known positive number. **Touch target gap found and
  fixed**: initial implementation was 32×32px; resized to the established
  44×44px (`2.75rem`) convention used throughout this revamp series and
  confirmed live via `getBoundingClientRect()`.
- Wishlist button: `aria-pressed` reflects saved state, `aria-label` text
  changes between "Save .../Remove ..." — verified live with a real login.
- Primary action has a real `disabled` state (`product.stock === 0`) with
  matching visible label change ("Out of stock"), now consistent between
  the main action row and the sticky bar (previously only the sticky bar
  had this).
- No accordions/tabs are used (Task E.9), so no related semantics needed.
- Review form: every field is wrapped in a `<label>` (implicit
  association, valid per spec) — `StarPicker`, the title/body inputs, the
  three `ReviewRange` sliders, and the verified-purchase checkbox all
  inherit a label this way; unchanged this phase (existing submission
  rules preserved exactly as instructed).
- `:focus-visible` confirmed functional on the product page via
  `document.activeElement.matches(':focus-visible')` after real Tab
  keypresses.
- Zero duplicate `id` attributes (checked programmatically across the
  full rendered page).
- Zero headings nested inside buttons (checked programmatically); the
  actual pattern present is the reverse (a `<button>` inside an `<h1>`/
  `<h3>` title in the related-product cards), which is valid and was
  already established in Phase 4.
- **Decorative icons missing `aria-hidden`**: found 28 instances across
  `ProductDetailPage.jsx` with no `aria-hidden`, plus one in
  `ReviewContributionPanel.jsx` (`Send`), plus one inside the shared
  `PanelHeader.jsx` (used by `ReviewContributionPanel` here, and also by
  ~30 Seller/Admin dashboard panels). Fixed all of them — a purely additive,
  zero-visual-impact attribute, safe even on the shared component. Confirmed
  zero remaining `<svg>` elements without `aria-hidden="true"` inside
  `<main>` via a programmatic sweep.
- No keyboard trap: there is no modal/dialog on this page to trap focus in.
- Touch targets ≥44px: quantity buttons fixed (above). The shared
  `.icon-button`/`.primary-action`/`.secondary-action`/`.ghost-action` base
  is `min-height: 2.5rem` (40px) — this is the **same pre-existing,
  already-documented divergence Phase 1 found and explicitly chose not to
  fix**, because it's a shared base rule affecting every button across all
  5 apps. Not touched again here for the same reason; the wishlist button
  inherits this pre-existing 40px from `.icon-button`, identically to how
  `ProductCard.jsx`'s own wishlist button already does today.

## Task I — Responsive results

Verified live and via screenshots at all four required widths:

| Width | Columns | Overflow | Console errors |
|---|---|---|---|
| 375px | 1 | 0px | 0 |
| 768px | 1 | 0px | 0 |
| 1280px | 2 | 0px | 0 |
| 1440px | 2 | 0px | 0 |

At 375px: media fills the full available width (was ~139px before the
fix); thumbnails N/A; the quantity stepper and action buttons wrap onto
clean rows via the existing `flex-wrap` on `.detail-actions`; the sticky
bar appears only after scrolling past the action row and occupies a
slim, fixed-height bottom strip — it does not cover the seller card or any
other content above it (confirmed via screenshot).

At desktop (1280/1440): columns are balanced (0.85fr/1.15fr), the gallery
is not undersized (spans the full combined height of the info+seller-card
column), and the sticky bar never appears at desktop width at all (its
trigger condition — `IntersectionObserver` on the actions row — combined
with the action row normally staying in view at this width). Long
titles/seller names were not specifically stress-tested with synthetic
extreme-length strings this phase (out of the explicit checklist), but the
existing `overflow-wrap: break-word` rules on this card family (inherited
from the shared compound at the top of the product-detail CSS block) were
confirmed still in place and untouched.

## Task J — CSS quality

- All new/touched rules use canonical tokens (`var(--brand-dark)`,
  `var(--paper)`, `var(--line)`, `var(--ink)`, `var(--muted)`,
  `var(--sand)` — the last one is a **pre-existing** undefined-token
  usage already present in the rules this phase touched
  (`color-mix(in srgb, var(--line) 84%, var(--sand))`), not introduced by
  this phase. Consistent with every prior phase's instruction, `--sand`
  was **not** defined — it remains one of the eight deliberately
  unresolved variables.
- No new raw one-off colours were added — the quantity stepper and its
  buttons use only existing tokens.
- No `!important` added anywhere.
- No selector deeper than necessary; the new `.product-detail-layout
  .product-gallery-panel` / `.product-detail-main` / `.detail-shop-card`
  descendant rules are exactly as deep as required to place specific
  children within the grid and no deeper.
- Canonical breakpoints used throughout: the critical layout fix uses the
  existing 1180px/820px shared compounds (no new breakpoint introduced for
  it); the sticky-bar relocation moved rules *onto* the canonical 820px
  breakpoint (Task D #3).
- **No new one-off breakpoint was introduced.** The pre-existing 700px
  one-off (shared with Gifting-page rules) had its Product-Detail-specific
  members removed and relocated to 820px; the Gifting-only members were
  left exactly as they were, since changing them is out of this phase's
  scope and the breakpoint may well be necessary for that unrelated page.
- Logical properties: none of the rules touched this phase had a
  meaningful directional property to convert (grid templates, colors,
  flex/grid placement, sizes — none are directionally sensitive in a way
  logical properties would change).
- Shared product-card behaviour (Phase 4's `.product-card`/`.cake-card`/
  `.gift-card`/`.catalog-card-*`) was not modified — related/pairing rails
  use `ProductCardRouter` unmodified.

## Lines and bundle size

| Metric | Before Phase 5 | After Phase 5 | Change |
|---|---|---|---|
| `storefront.css` lines | 10,250 | 10,349 | +99 (consolidation comments, quantity-stepper CSS, sticky-bar relocation, ownership notes) |
| `client.css` lines | 2,507 | 2,507 | 0 (removed 4 lines of dead-end CSS, added a 4-line pointer comment) |
| `ProductDetailPage.jsx` lines | 559 | 601 | +42 (quantity stepper, wishlist button, aria-hidden sweep, one removed dead button/prop) |
| `ReviewContributionPanel.jsx` lines | 114 | 118 | +4 (empty-state branch) |
| `PanelHeader.jsx` lines | 11 | 11 | 0 (one attribute added in place) |
| Customer web CSS bundle (raw) | 235.12 kB | 235.99 kB | +0.87 kB |
| Customer web CSS bundle (gzip) | 41.15 kB | 41.17 kB | +0.02 kB |
| Seller / Admin CSS bundles | unchanged | unchanged | 0 bytes |
| Seller / Admin JS bundles | — | — | **changed by a few bytes** — see note below |
| Driver / SR bundles (CSS+JS) | unchanged | unchanged | 0 bytes |

**Note on Seller/Admin**: unlike Phases 1–4, this phase touched one file
outside `apps/web` — `packages/shared/components/PanelHeader.jsx` — which
is used by ~30 Seller and Admin dashboard panels in addition to this
page's review section. The change is a single additive `aria-hidden="true"`
attribute with zero visual or behavioral effect, but it does mean Seller's
and Admin's JS bundles are no longer byte-identical to their pre-Phase-5
state (their CSS bundles are unaffected, confirmed identical). This was a
deliberate, low-risk exception to the "zero impact outside apps/web"
pattern established in earlier phases, made because the fix is purely a
screen-reader affordance with no other observable effect on any of those
panels.

## Verification

- `git diff --check` — clean.
- `npm run test:critical-smoke` — 5/5 pass, including "public storefront
  filtering."
- `npm run build` — all five workspaces build clean.
- Functional, live-browser checks: Shop card → Product Detail; direct URL
  load; refresh; perfume/cake/dessert/gift-set all render with no blank
  sections; quantity stepper (incl. disabled-at-1 and cart-store
  verification of the actual persisted quantity); Add to Cart; wishlist
  save/remove with a real login (`customer@tuti.dev`); seller "Browse all
  sellers" link → `/shop`; related-product card click → correct
  `/products/:id`; not-found state for a nonexistent ID; Home/Shop/Cart
  unaffected.
- Visual checks captured and reviewed at 375/768/1280/1440px for perfume,
  cake, and gift-set detail pages, plus the not-found state and the mobile
  sticky bar mid-scroll.
- Accessibility checks: one `<h1>`, zero duplicate IDs, zero headings
  inside buttons, zero `<svg>` without `aria-hidden` in `<main>`,
  `:focus-visible` functional, quantity touch targets corrected to 44px.

## Pre-existing work preserved

All pre-flight items are present and unchanged after this phase. Phase 5's
own changes: `ProductDetailPage.jsx`, `ReviewContributionPanel.jsx`,
`storefront.css`, and `client.css` modified; `PanelHeader.jsx` (shared,
outside `apps/web`) modified; this document added.

## Remaining Product Detail debt

- **Loading/error states remain app-wide** (Task G) — same architectural
  gap Phase 4 already documented for Shop, now confirmed identical for
  Product Detail. A real fix needs an `App.jsx`-level change affecting
  every route.
- **"Unavailable" reasons aren't distinguished** beyond out-of-stock (Task
  G) — would need a backend signal that doesn't currently exist.
- The not-found state (`.not-found-panel`) is functionally complete but
  visually minimal (a small card in a large empty page) — left as-is since
  it already satisfies every literal requirement and a visual refresh
  wasn't a named gap, but it's a reasonable small polish candidate.
- `GiftBoxCard.jsx`'s borrowed `cake-*` class names (documented as Shop
  debt in Phase 4) remain unchanged — still purely a naming/maintainability
  nit with zero visual effect, still not worth the risk for the benefit.
- The shared `.icon-button`/action-button 40px-vs-44px touch-target
  divergence (Phase 1) remains — affects the new wishlist button
  identically to how it already affected every other icon-button in the
  app, including the original `ProductCard.jsx` wishlist button this
  phase's implementation deliberately matches.

## Recommendation for Phase 6

1. If a per-route loading skeleton is ever prioritized, scope it as its
   own phase across `App.jsx`'s data-loading sequencing — Shop and Product
   Detail both want it, and fixing it once would serve both.
2. Apply this phase's verification rigor (live API checks, real-login
   functional tests, not just static reading) to Cart/Checkout next — it's
   the page every Add to Cart and "Continue order" action on this page
   feeds into, and it hasn't had the same selector-by-selector treatment
   Shop and Product Detail just received.
3. Low-priority: a small visual refresh of the not-found state (a short
   supporting line of text, better vertical centering) — contained, no
   risk, not currently a named gap.
