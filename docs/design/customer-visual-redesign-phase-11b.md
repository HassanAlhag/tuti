# Customer Visual Redesign Phase 11B — Real Homepage and Shop Visual Redesign

**Status: PASS-CANDIDATE** (see Verification below).

Direct feedback going into this phase: Phase 11 was "technically safe but
visually not different enough" — shadows, radius, badges, hover states.
This phase made structural changes instead: new interactive surfaces, a
restructured visual hierarchy, and a full redesign of two page-opening
moments (Shop's header, the product card), not decoration on the existing
composition. Nothing committed, nothing staged.

## Exact files changed

| File | Nature of change |
|---|---|
| `apps/web/src/features/homepage/GiftingShortcuts.jsx` | Added a real AI prompt input bar; restructured the 6 shortcuts into a two-tier hierarchy (2 featured AI actions, 4 secondary brand actions) instead of one flat 6-column row |
| `apps/web/src/features/homepage/homepage.css` | New AI-bar styling, new two-tier shortcut-row styling, Trust section fully restructured, Final CTA second glow + gold accent rule, removed dead `.trust-strip` rules |
| `apps/web/src/features/pages/HomePage.jsx` | `TrustClosing` restructured from a 2-column "text + icon-pairs" layout into a heading band followed by 4 standalone elevated cards |
| `apps/web/src/features/homepage/FinalCTA.jsx` | Added the gold accent-rule element |
| `apps/web/src/features/storefront/StorefrontPage.jsx` | `ShopHeader` restructured into a full-bleed dark banner with an AI badge |
| `apps/web/src/features/storefront/components/ProductCard.jsx` | Wishlist/add-to-cart moved from a bottom icon-row onto floating buttons over the product image; rating moved to an image-overlay badge |
| `apps/web/src/styles/storefront.css` | New dark `.shop-header` banner, `.shop-shell` now floats over it (mirrors the homepage's hero→panel overlap), fully restructured `.trust-item` cards, new `.catalog-card-float-btn`/`.catalog-card-rating-badge` system |

`BottleArt.jsx`/`base.css` (Phase 11's shared-component change) were
**not touched this phase** — confirmed via `git diff --stat` showing zero
diff on either file, so the Seller app's compact rendering is unaffected
by logical certainty, not just by re-inspection.

## What changed visually in a way the user will notice immediately

### Homepage

**Gifting Shortcuts is now a real AI command bar, not a button row.**
The single biggest change on the page: a white pill-shaped input
("e.g. A birthday gift for my sister who loves florals…") with a sparkle
icon and a dark-gradient circular submit button sits above the
shortcuts — visually and functionally identical in spirit to a
ChatGPT/Perplexity-style prompt bar. Submitting it routes to
`/gifting`, the same real flow `onFindGift` already wired up — it's a
genuine new interactive surface, not decorative chrome. Below it, the
six shortcuts are no longer one flat row: the two AI actions (Find the
Perfect Gift, Find a Scent) are now large, soft-teal-tinted featured
cards with bigger icons and a trailing arrow; the four brand actions sit
below as a visually secondary row. The hierarchy itself communicates "AI
first, shortcuts second" at a glance.

**Trust/service promise is now four standalone elevated cards.** The
previous layout (a text block on the left, four icon+text pairs on the
right) is gone. The heading now sits on its own line above a full-width
row of four individually-bordered, individually-shadowed cards — each
lifts and its icon scales on hover. This reads as a deliberate bento
module, not a list.

**Final CTA has more depth.** A second, warmer radial glow low in the
section plus a small gold accent rule above the eyebrow — a tasteful
"premium signal" finishing touch (per D0.1's gold-usage rules: a thin
accent line is an explicitly approved use; gold as a button fill is not,
so the primary button's cream fill was deliberately left alone).

### Shop

**The page no longer opens into a plain light header.** `.shop-header`
is now a full-bleed dark forest-green banner (the same visual register as
the homepage's dark sections), carrying an "AI-ASSISTED SHOPPING" badge,
a large white headline, and a light-on-dark "Help me choose" button with
its own dedicated contrast-safe styling. This alone is the single most
visible change on the page — Shop now opens with the same branded weight
as the homepage hero instead of a generic catalogue header.

**The toolbar now floats over the banner**, pulled up with a negative
margin so it visually overlaps the dark header — directly mirroring the
homepage's hero→Gifting-Shortcuts-panel relationship. This is a
deliberate, repeated design-system pattern across both pages, not a
one-off effect.

**Product cards now put the actions on the image, not under the price.**
Add-to-cart is a floating dark-green circular button in the top-right
corner of the product photo; the wishlist heart sits above it when
signed in; the star rating moved to a small frosted badge in the
image's bottom-left corner. The card body below is now just seller/
category, title, summary, fit/availability chips, then price + "View
details" — no redundant icon-button row. This is the same visual
language high-end editorial ecommerce (the brief's "Apple-inspired /
premium SaaS" reference point) uses, and it's immediately distinguishable
from the previous "icon row under the price" generic-catalogue pattern.

## Homepage before/after summary

| Element | Before (Phase 11) | After (Phase 11B) |
|---|---|---|
| Gifting Shortcuts | Flat 6-column row of equal-weight icon tiles in a glass panel | A real AI prompt input bar + a two-tier hierarchy (2 large featured AI cards, 4 secondary brand tiles) |
| Trust/service promise | Text block (left) + 2×2 icon-and-text pairs (right), one shared layout | Heading band on its own line + a full-width row of 4 independently-elevated cards |
| Final CTA | Dark gradient + one soft glow | Dark gradient + two glows + a gold accent rule above the eyebrow |

## Shop before/after summary

| Element | Before (Phase 11) | After (Phase 11B) |
|---|---|---|
| Shop header | Light-background text block (kicker/h1/p + count + button) | Full-bleed dark banner with an AI badge, white type, and a contrast-tuned CTA |
| Toolbar | Sat directly below the header as the next block in flow | Pulled up to visually float/overlap the dark banner — same pattern as the homepage hero |
| Product card actions | Icon-button row (wishlist, add-to-cart) under the price, next to a "View details" button | Floating glass buttons over the product image; rating moved to an image badge; body keeps just price + "View details" |

## Checks performed

- **Responsive**: Home + Shop × 375/768/1280/1440px — 0px horizontal
  overflow on every combination, screenshotted and reviewed at each size.
  Specifically verified at 375px: the AI bar and its submit button stack
  and remain usable; the two featured shortcut cards go full-width; the
  brand-action row remains a horizontally-scrollable strip (unchanged
  mechanism, just now scoped to 4 items instead of 6); the dark shop
  banner and floating toolbar both read cleanly stacked.
- **Functional**: product title click → Product Detail; floating
  add-to-cart button → cart updates correctly; AI bar submit → navigates
  to `/gifting`; featured "Find a Scent" card → navigates to
  `/fragrance-finder`; an unknown route still renders `RouteNotFound`
  (Phase 8's route-state system untouched). Zero console errors across
  every check.
- **Accessibility**: exactly one `<h1>` on the homepage; the AI bar input
  and submit button both have explicit `aria-label`s and are keyboard-
  focusable; every floating card button has a real per-product
  `aria-label` (e.g. "Add Velvet Musk No. 8 to cart"). **Found and fixed
  a real touch-target gap**: the new floating card buttons and the AI
  bar's submit button were both 40px — confirmed via live measurement,
  not assumed — raised to 44px (2.75rem) and re-verified.
- **Cross-app**: `BottleArt.jsx`/`base.css` (Phase 11's shared-component
  change) have zero diff this phase — confirmed via `git diff --stat` —
  so Seller's compact rendering is unaffected by logical certainty.

## Verification

- `git diff --check` — clean.
- CSS comment-balance: `storefront.css` 181/181, `homepage.css` 43/43 —
  both balanced, checked after every edit.
- `npm run test:critical-smoke` — 5/5 pass.
- `npm run build` — all five workspaces build clean.

## Bundle size

| App | CSS before → after | JS before → after |
|---|---|---|
| Customer web | 243.93 kB → 248.70 kB (+4.77 kB) | 490.58 kB → 491.33 kB (+0.75 kB) |
| Seller / Admin / Driver / SR | unchanged | unchanged |

Seller/Admin/Driver/SR are byte-identical to Phase 11's end state —
every file touched this phase is customer-web-exclusive.

## What was deliberately not changed

- Hero architecture (`ImmersiveStory`) — Phase 11 already gave its glass
  card rail real depth; this phase's effort went to the two biggest
  remaining "looks generic" surfaces (Gifting Shortcuts, the Shop page)
  rather than re-touching something already working.
- Path Selector, Gift Builder Preview, Occasion Discovery, Editorial
  Discovery — already genuine bento/structured layouts (confirmed in
  Phase 11's research), not the weak/generic elements the feedback was
  about.
- Shop's category/sort/family-filter logic, cart, checkout, and all
  routing — visual-only changes throughout; zero behavior changes beyond
  the AI prompt bar's new (real, working) submit handler.

## Risks

- **Low**: every structural change reuses already-proven CSS techniques
  from this same codebase (floating overlap panels, glass surfaces,
  scoped touch-target overrides) rather than introducing new patterns.
- **Low**: the product card restructure changes a high-traffic, shared
  component (`ProductCard.jsx`), but only its layout/class names — the
  underlying `onAddToCart`/`toggle`/`viewProduct` handlers are unchanged,
  and the floating-button click handlers were verified live, not assumed.
- **None identified** for accessibility (the one real gap found was
  fixed and re-verified) or cross-app impact (zero shared-file diff).

## PASS-CANDIDATE
