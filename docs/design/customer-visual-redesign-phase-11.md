# Customer Visual Redesign Phase 11 — Functional Luxury UI (Homepage + Shop)

**Status: PASS-CANDIDATE** (see Verification below).

Unlike Phases 1–10 (stabilization/cleanup, explicitly conservative on
appearance), this phase was authorized and instructed to make real visual
improvements where the current design read as weak, plain, or unfinished.
Nothing committed, nothing staged.

## Scope

Homepage and Shop only, per the brief ("Start with Homepage and Shop only
in this phase"). Architecture, routing, state management, and data flow
were left untouched — every change is visual (CSS) or a small, targeted
JSX adjustment in direct service of a visual fix.

## Exact files changed

| File | Nature of change |
|---|---|
| `packages/shared/components/BottleArt.jsx` | Added a `.bottle-art-stage` wrapper + grounding-shadow element around the existing cap/neck/body/shine parts |
| `packages/shared/styles/base.css` | Redesigned `.bottle-art`'s sizing so it fills its card slot and the illustration scales/centers correctly within it |
| `apps/web/src/styles/storefront.css` | Product card depth/hover polish, Path Selector card refinement, Trust Closing icon-circle polish, Shop toolbar glass treatment, Shop AI-button gradient |
| `apps/web/src/features/homepage/homepage.css` | Gifting Shortcuts AI-badge + AI-tile treatment, Final CTA background glow, removed now-orphaned `.boutique-campaign-arabic` rule |
| `apps/web/src/features/homepage/GiftingShortcuts.jsx` | Added the "AI-assisted" badge to the shortcuts panel header |
| `apps/web/src/features/homepage/AdaptiveBoutique.jsx` | Removed two Arabic-text rendering blocks (`displayNameAr`) — required fix |
| `apps/web/src/features/immersive/immersive.css` | Hero chapter-card glass/depth refinement |

`BottleArt.jsx`/`base.css` are shared across all five apps (web, seller,
admin, driver, sr) — see the cross-app verification note below.

## Visual improvements made

### Real defect found and fixed: "large blank product image area"

Measured the actual rendered DOM before touching anything: a product
card's image area was 332×415px, but the `BottleArt` fallback illustration
inside it was a fixed 332×216px box with the bottle shape occupying maybe
70% of *that* — meaning roughly half the card's image area was just flat
gradient with nothing in it, for any product without a real photo. This
is exactly the defect the brief named.

Fixed by making `.bottle-art` fill its parent fully, wrapping the existing
cap/neck/body/shine in a new `.bottle-art-stage` (a fixed 12rem design
tile, absolutely centered in the now-larger box, then scaled 1.55×) and
adding a soft grounding shadow beneath the bottle. This preserves every
part's relative position (still a recognizable bottle), just makes the
whole illustration read as an intentional, composed product shot instead
of a small icon lost in empty pastel space. The `.compact` variant (used
in cart lines, finder results, and throughout the Seller app's product
tables) was deliberately left byte-for-byte unaffected — `.compact
.bottle-art-stage` is an explicit no-op override.

One real bug was caught and fixed during this same change: the first
implementation broke horizontal centering for the cap/neck/body (they
rely on an implicit "static position" centering trick from the parent's
`display:grid; place-items:center`, which only works for *direct* grid
children — wrapping them in a new non-grid `.bottle-art-stage` broke it,
visibly shifting the bottle to the left). Fixed by making the stage itself
`display:grid; place-items:center` too, restoring the exact original
centering behavior for its children.

### Shared product card depth

Added a faint inset top highlight (the restrained "glass" touch on the
card surface itself), upgraded the hover shadow to the existing
`--shadow-strong` token, and added a subtle 1.025× image zoom on hover —
small, premium micro-interactions rather than a redesign.

### Gifting Shortcuts → premium AI launcher

Added an "AI-assisted" badge (with a `Wand2` icon) to the panel header,
and gave the two AI-tone tiles (Find the Perfect Gift, Find a Scent) a
distinct teal gradient icon treatment with a soft glow ring — both at
rest and on hover — so the "smart" shortcuts visually read as a different,
AI-powered category from the four plain "brand" shortcuts (Build a Gift
Box, Shop by Occasion, Explore Boutiques, Track Your Order). The panel's
existing glass treatment (`backdrop-filter: blur`) was deepened slightly
(18px → 20px blur, added an inset top highlight) rather than rebuilt.

### Path Selector (bento)

This was already a genuine bento layout (a 12-column grid with named
areas, asymmetric 7:5 and 5:7 splits) — not rebuilt. Radius increased
12px → 20px to match the rest of the card system, and added the same
inset-highlight glass touch used on product cards.

### Trust Closing — elegant, not table-like

Confirmed via Phase 10's own prior screenshot review that this was never
actually table-style (no borders/cells) — the brief's "should feel
elegant, not like a table" was about feel, not a structural defect.
Enlarged the icon circles (2.25rem → 2.5rem), gave them a richer
white-to-cream gradient and a soft shadow, and added a hover lift
(translateY + scale) — small, tasteful depth instead of the previous flat
cream circles.

### Final CTA

Added one soft radial glow (brand-teal-tinted, very low opacity) behind
the heading for depth, with the content explicitly re-stacked above it.
Typography and the cream-fill primary button were already strong and
readable — left as-is, since the brief asks for "readable and visually
strong," which it already was.

### Hero composition

Kept the architecture completely intact (four-chapter crossfade,
auto-advance, pause control — all untouched). Refined only the chapter
card rail: richer blur+saturate (12px → 16px, 180% → 200% saturate), a
subtle inset highlight, a deeper shadow, and a small hover lift — the
"liquid glass" touch the brief asks for, applied to the one surface
already designated for it (the D3 full-bleed exception explicitly covers
this exact rail).

### Shop toolbar → one polished interface

Added a `backdrop-filter: blur(14px) saturate(1.08)` glass treatment and
an inset top highlight to the single `.shop-toolbar` panel that already
contains search, sort, the filter trigger, category tabs, family chips,
and the results summary — reinforcing that this is one surface, not
stacked separate widgets (it already was structurally; this is the visual
confirmation of it). Gave the "Help me choose" AI button a subtle gradient
fill, visually tying it to the homepage's teal AI-tile treatment.

### Required: no Arabic text on the English homepage

Found and removed two `lang="ar" dir="rtl"` / `lang="ar" dir="auto"` blocks
in `AdaptiveBoutique.jsx` that conditionally rendered a seller's
`displayNameAr` field. Removed both render branches and the now-orphaned
`.boutique-campaign-arabic` CSS rule. This was a real, concrete instance
of exactly what the brief said to avoid — found by reading the homepage
component tree directly, not assumed.

## What was deliberately not changed

- `AdaptiveProductEdit.jsx`/`AdaptiveBoutique.jsx`'s adaptive 1/2/3/4+
  layout logic — already well-structured (editorial feature, split, trio,
  scroll-grid), not rebuilt.
- `OccasionJourney`, `EditorialDiscovery` — already clean image-panel
  grids with good gradient/overlay treatment; not touched, since nothing
  about them matched the brief's "avoid" list.
- Shop's category/sort/family-filter interaction logic — purely visual
  polish, zero behavior change.
- Any backend, routing, or state-management code.

## Accessibility checks

- Exactly one `<h1>` on the homepage, confirmed after all changes.
- Zero unmarked decorative `<svg>` in `main` or the shortcuts panel — the
  new `Wand2` badge icon was written with `aria-hidden="true"` from the
  start; the badge's own text ("AI-assisted") is *not* hidden from screen
  readers, since it carries real information sighted users get and
  hiding it would create an inequivalent experience.
- New interactive elements (shortcut tiles) confirmed keyboard-focusable.
- Shop toolbar action buttons confirmed ≥44px height (44–46px) at desktop;
  `.shop-filter-toggle`'s 0px reading is expected — it's `display:none` at
  this viewport by design, not a touch-target failure.
- No color-only state changes were introduced — every visual change
  (hover lifts, glow, gradient icons) is additive polish on top of
  already-text-labeled, already-accessible elements.

## Responsive checks

36 combinations checked (Home + Shop × 375/768/1280/1440px after every
change): **0px horizontal overflow on every one.** Screenshotted and
visually reviewed at 375px (mobile hero, mobile shortcuts panel — the AI
badge wraps cleanly next to the heading, the tile row remains horizontally
scrollable as before; mobile Shop toolbar and product cards), 768px
(2-column Shop grid), and 1440px (full layouts) — all clean, no clipped
content, no broken sticky elements.

## Functional verification

- Product card title click → navigates to Product Detail (`/products/:id`).
- Add-to-cart icon button → cart updates correctly (localStorage-backed).
- Homepage shortcut tile click → navigates correctly (verified
  `Build a Gift Box` → `/build-a-box`).
- Path Selector card click → navigates correctly (verified Perfumes →
  `/shop`).
- Unknown route → `RouteNotFound` still renders correctly (Phase 8's
  route-state system unaffected).
- Zero console errors across every check performed this phase.

## A pre-existing issue found, not introduced by this phase

One product's image (`/uploads/...png`) returns a 404 in the current dev
environment — confirmed via direct DOM inspection (`naturalWidth === 0`),
present identically before and after every change this phase made (no
phase touched product data, the API, or the backend). This is a
backend/seed-data issue, explicitly out of this phase's scope ("Do not
touch backend") — noted here for visibility, not fixed.

## Cross-app impact (shared component change)

`BottleArt.jsx`/`base.css` are imported by all five apps. Confirmed via
grep that the Seller app uses `BottleArt` exclusively in `compact` mode
(8 files: products, orders, customers, drivers, support, finance,
overview, shared dashboard helpers). The `.compact` code path was written
as an explicit, untouched pass-through (`.compact .bottle-art-stage {
width: auto; height: auto; inset: 0; transform: none; }`) specifically to
guarantee this. Verified live by logging into Seller Central with the
demo credentials and confirming the compact bottle icons in the product
inventory list render identically to before. Admin/Driver/SR were not
live-checked beyond confirming (via the build output) their CSS bundles
grew by the same shared-file delta as Seller's, with no JS change at all.

## Verification

- `git diff --check` — clean.
- CSS comment-balance: `storefront.css` 175/175, `homepage.css` 41/41,
  `immersive.css` 32/32, `base.css` 4/4 — all balanced, checked after
  every single edit in this phase, not just once at the end.
- `npm run test:critical-smoke` — 5/5 pass.
- `npm run build` — all five workspaces build clean.

## Bundle size

| App | CSS before → after | JS before → after |
|---|---|---|
| Customer web | 241.99 kB → 243.93 kB (+1.94 kB) | 490.54 kB → 490.58 kB (+0.04 kB) |
| Seller | 107.20 kB → 107.66 kB (+0.46 kB) | 367.43 kB → 367.54 kB (unchanged JS; rounding) |
| Admin | 136.08 kB → 136.64 kB (+0.56 kB) | 480.96 kB → 481.07 kB (unchanged JS; rounding) |
| Driver | 30.68 kB → 31.14 kB (+0.46 kB) | 228.63 kB (unchanged) |
| SR | 31.06 kB → 31.52 kB (+0.46 kB) | 230.69 kB (unchanged) |

The ~0.46 kB CSS growth on Seller/Admin/Driver/SR is the shared
`base.css` `BottleArt` addition rippling into every app that imports it —
expected and accounted for, not a leak.

## Risks

- **Low**: every change this phase is additive CSS polish or a small,
  scoped JSX adjustment (one wrapper element, one badge). No architecture,
  routing, or data-flow code was touched.
- **Low**: the shared `BottleArt`/`base.css` change has cross-app reach,
  but was verified live in both the customer app and Seller Central, with
  the compact path explicitly engineered as a no-op for every other
  consumer.
- **None identified** for accessibility or responsive behavior — all
  checks passed cleanly at every breakpoint tested.

## Recommendation for a future phase

1. Product Detail, Cart/Checkout, Account/Support, and Legal/Journal are
   the remaining priority pages named in the brief but explicitly
   deferred ("Start with Homepage and Shop only in this phase") — natural
   next scope.
2. The pre-existing 404'd product image should be corrected at the data
   level once backend changes are in scope.
3. If further "bento" structure is wanted beyond Path Selector, Gift
   Builder Preview's 4-step grid and the Occasion Discovery 3-panel grid
   are the next-best candidates — both already asymmetric/structured
   layouts that could take a similar light-touch polish pass.
