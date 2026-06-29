# CSS Revamp Audit — Tuti Customer Web

**Scope:** `apps/web` (customer-facing storefront) and its two upstream stylesheets in
`packages/shared/styles/`. This is a **read-only audit** — no application code or CSS
was modified to produce this document, and nothing here has been committed.

**Out of scope:** `apps/seller/src/styles/seller.css` (5,513 lines) and
`apps/admin/src/styles/{admin-dashboard,admin}.css` (7,562 lines combined). Both import
the same `tokens.css`/`base.css` as the customer app, so any change to the shared layer
(§2) affects them too — flagged where relevant, not audited in depth.

---

## 0. Method and a note on confidence

This audit combined direct inspection (file reads, greps, a production build to inspect
actual byte-level cascade order) with three parallel automated research passes. Every
non-trivial automated claim was spot-checked against current JSX before being included
here, because the automated passes produced a meaningful number of **false positives**:

- Claimed `.cl-*` classes were "Clerk auth integration, never wired up." False —
  `cl-` stands for the existing `ClientLayout` component; `.cl-bar1`, `.cl-account-chip`,
  `.cl-cart-chip`, `.cl-dropdown-*` are all live. (A real subset of `cl-*` *is* dead —
  see §5 — but the blanket claim was wrong.)
- Claimed `.catalog-card-media`, `.catalog-card-body`, `.catalog-card-footer`,
  `.catalog-card-tags`, `.catalog-card-view` were dead. False — all five are live in
  `ProductCard.jsx`, `CakeCard.jsx`, `GiftBoxCard.jsx`. The detector missed classes that
  appear as the second token in a multi-class `className="a b"` string.
- Claimed `.ghost-action` is used by 3 files. Actual count: **15 files.**
- Claimed `.eyebrow`/`.primary-action`/`.secondary-action`/`.icon-button` usage counts
  were each undercounted by roughly 2–5×.

Every count and dead/alive determination quoted below as fact was independently
re-verified with a fresh `grep` against current `apps/web/src` and `packages/shared`
JSX. Where a finding is structural (section maps, duplicate-selector line numbers,
media-query tallies) rather than a JSX-presence claim, it came from the automated pass
and was spot-checked on a sample rather than exhaustively re-walked line by line — those
are flagged "sampled" below.

---

## 1. File inventory

| File | Lines | Layer | Imported from |
|---|---|---|---|
| `packages/shared/styles/tokens.css` | 109 | shared design tokens | `main.jsx` (1st) |
| `packages/shared/styles/base.css` | 341 | shared base reset + atoms | `main.jsx` (2nd) |
| `apps/web/src/styles/storefront.css` | 11,040 | app — nearly every page's CSS | `main.jsx` (3rd) |
| `apps/web/src/styles/client.css` | 2,576 | app — `ClientLayout` (topbar/nav/drawer) | `main.jsx` (4th) |
| `apps/web/src/features/homepage/homepage.css` | 1,539 | feature — homepage sections | `HomePage.jsx` |
| `apps/web/src/features/immersive/immersive.css` | 391 | feature — hero slider | `ImmersiveStory.jsx` |
| **Total, customer web** | **~16,000** | | |

No `stylelint`/`postcss` config exists anywhere in the repo. No CSS Modules, no
CSS-in-JS. Every class name is a bare global string — nothing in the toolchain prevents
two unrelated files from defining the same selector, and several do (§4).

`storefront.css` is 72× the size of `immersive.css` and is the de facto "everything"
file: it contains topbar remnants, hero remnants, every page's layout, the shop
catalogue, build-a-box, checkout, account, legal pages, **and** an admin/seller-flavored
block (§5) that has no business being in the customer bundle at all.

---

## 2. Finding 1 — Two competing token systems; one is silently dead

`packages/shared/styles/tokens.css` defines a `:root` block (109 lines) with a full
design-token system: brand/neutral/semantic colors, type scale, font weights, line
heights, an 8-step spacing scale, radii, shadows, z-index layers, transition durations,
breakpoint references, and layout constants.

`apps/web/src/styles/storefront.css` **also** opens with its own `:root` block (lines
1–35) that redeclares every color and shadow token tokens.css defines — with different
values — but does not touch the structural scale (spacing/type/radius/z-index/etc.,
which therefore *does* correctly come from `tokens.css`, uncontested).

Because `:root` selectors have identical specificity everywhere, and because
`storefront.css` is loaded after `tokens.css` (confirmed both in `main.jsx` source order
*and* empirically in the production bundle, §3), **`storefront.css`'s values always
win** for every name below. `tokens.css`'s color/shadow values are dead code for
`apps/web` specifically — they're real and presumably still load-bearing for
`apps/seller`/`apps/admin`, which is exactly why this can't just be deleted without
checking those two apps first.

| Token | `tokens.css` | `storefront.css` (wins in apps/web) |
|---|---|---|
| `--brand` | `#0f6f61` | `#005c46` |
| `--brand-dark` | `#0b4e47` | `#013d32` |
| `--ink` | `#15201d` | `#171717` |
| `--paper` | `#f7faf8` (cool off-white) | `#fbf7ef` (warm cream) |
| `--panel` | `#ffffff` | `#fffdf8` |
| `--blue` / `--info` | `#2d6cdf` — **actually blue** | `#1b8a7a` — **actually teal/green** |
| `--danger` | `#b42318` (red) | `#9f5139` (rust/brown) |
| `--gold` | `#d9a441` | `#d7a84a` |
| `--shadow-md` | `0 12px 36px rgba(21,32,29,.11)` | `0 14px 36px rgba(23,23,23,.12)` |

The `--blue`/`--info` collision is the sharpest example: the name promises blue, and
delivers teal. Anyone reading `tokens.css` to learn the palette — or anyone working in
`apps/seller`/`apps/admin` where `tokens.css` is *not* shadowed — forms an incorrect
mental model of what renders in the customer app.

**Classification: `merge`.** This has to be reconciled into one canonical set before any
further visual work, or every future "use `var(--x)`" instruction is a coin flip between
two real, different colors.

---

## 3. Finding 2 — Production cascade order does not follow import order

`main.jsx` imports CSS in this textual order: `tokens.css` → `base.css` →
`storefront.css` → `client.css`. `homepage.css` and `immersive.css` are imported inside
`HomePage.jsx` and `ImmersiveStory.jsx` respectively — component-level, not app-level.

The natural assumption is that this textual order is the cascade order. **It is not.**
A production build was run and the resulting single CSS bundle
(`apps/web/dist/assets/index-*.css`, 251,515 bytes) was inspected by byte offset for a
marker string unique to each source file:

| Cascade position (byte offset) | File | What was found there |
|---|---|---|
| 0 (first) | `immersive.css` | `.is-hero{...}` |
| 23,767 | `homepage.css` | `.gifting-shortcuts{...}` |
| 26,347 | `tokens.css` | `--brand:#0f6f61` |
| 30,822 | `base.css` | `.notification-menu{...}` |
| 33,820 | `storefront.css` (`:root`) | `--brand:#005c46` |
| 100,804 | `storefront.css` (body) | `.shop-toolbar{...}` |
| 207,255 (of 251,515 — final ~18%) | `client.css` | `.cl-bar1` |

**`client.css` wins every collision** against all three other web-layer files; `immersive.css`
and `homepage.css` lose every collision against `storefront.css` and `client.css` — the
exact opposite of what reading `main.jsx` would suggest. This isn't a bug today (nothing
is visibly broken), but it is a **non-obvious, refactor-fragile fact**: introducing
route-based code-splitting (`React.lazy`) would change how Rollup chunks and orders
this CSS, and any selector that currently "wins" only because of this accidental
ordering could silently flip.

**Action implied for §9 (migration order):** `client.css` should be touched last/most
carefully in any revamp, because the rest of the app currently depends on it having the
final word. `homepage.css`/`immersive.css` should never be assumed to beat
`storefront.css` on a shared selector — they currently can't.

---

## 4. Duplicate selectors

### 4a. Cross-file (same class, standalone rule, in 2+ files) — verified samples

| Class | Found in | Note |
|---|---|---|
| `.finder-layout` | `client.css:588`, `storefront.css:5467` | full duplicate rule pair |
| `.sitemap-card` (+ `.dark`, `-icon`, hover, `h2`, `p` variants) | `client.css:529–573`, `storefront.css:5422–5462` | a whole *family* of rules duplicated, not just one selector |
| `.featured-product-card` | `client.css:1264` **and again** `client.css:2407`, plus `homepage.css:1022,1052` (`:active`, `--ghost`), plus `storefront.css:10841` (`:focus-visible`) | duplicated *within* client.css itself, and partially overridden from two more files |
| `.boutique-discovery` | `homepage.css:9` (full), `storefront.css:10774` (`h2` only — partial override) | |
| `.editorial-link-image` | `homepage.css:831` (full), `storefront.css:10914` (partial override) | |

Sampled via targeted grep, not an exhaustive walk of every selector in all four files.
The automated pass additionally reported ~12 more `storefront.css` ↔ `homepage.css`
overlaps and ~21 more `storefront.css` ↔ `client.css` overlaps in the same shape
(boutique/editorial/finder/sitemap-prefixed); the pattern above is representative of
all of them — re-verify exact line numbers before touching any specific one.

### 4b. Within `storefront.css` itself — verified samples

| Class | Lines | What differs |
|---|---|---|
| `.home-page` | `3616`, `10281` | first is a one-line `background` rule; second is a full override (gradient + `margin-top: -6rem` for the hero-overlap effect added this design cycle) |
| `.home-content` | `3717`, `10288` | first sets the original padding/gap; second (added during the homepage rebuild) zeroes `padding-top` and changes `gap` |
| `.trust-closing` | `10589`, `10889` | two full re-definitions of the same section across two different reconstruction passes |

These three are confirmed by direct read. The automated section-map pass (sampled, not
exhaustively re-verified) found roughly **24 more** of this shape — same class
redefined 2–4× later in the file, always inside a block self-labeled in a comment as a
"reconstruction" or "finishing pass." Notable repeat offenders it flagged:
`.ghost-action` (3×), `.metric-card` (2×), `.detail-shop-card` (3×),
`.order-confirmation-panel` (2×), `.checkout-summary-card` (2×). Treat the exact list as
directional — the *pattern* (the file has been edited by successively appending an
override block rather than editing the original rule in place) is the real finding, and
it's consistent with this session's own editing history (every homepage change this
cycle was applied as a new override block, e.g. the "HOMEPAGE RECONSTRUCTION OVERRIDES"
and "PROFESSIONAL FINISHING PASS" sections near the end of the file).

**Classification: `merge`.** Each pair should become one rule before any section is
next touched — not a blocking prerequisite for the whole file, but a "fix while you're
in there" rule for the migration order in §9.

---

## 5. Dead / orphaned CSS — verified

Every class below was checked with `grep -rl '<class>' apps/web/src packages/shared
--include="*.jsx"` and returned **zero matches** at the time of this audit:

**An entire dead header+hero implementation, tied to two orphaned components.**
`apps/web/src/features/storefront/components/CommerceHeader.jsx` and
`HeroShowcase.jsx` both exist, both define real JSX using these classes — but neither
component is imported anywhere in the app (confirmed: no other file references
`CommerceHeader` or `HeroShowcase`). The classes they use —
`.commerce-header`, `.commerce-search`, `.commerce-account`, `.commerce-menu`,
`.commerce-cart`, `.delivery-chip`, `.hero-band`, `.hero-content`, `.hero-proof`,
`.hero-stats`, `.premium-hero`, `.nav-button` — are dead **CSS tied to dead JSX**. This
whole cluster (storefront.css's early "Topbar & Navigation" / "Hero & Actions"
sections, roughly lines 77–433) can be deleted as one unit, file and CSS together, once
someone confirms neither component is referenced by name anywhere outside its own file
(confirmed above) or dynamically (not checked — dynamic `import()` by string would not
show up in a static grep).

**An entire dead admin/seller-flavored block that should never have shipped to the
customer bundle:** `.admin-shell`, `.admin-sidebar`, `.admin-brand`, `.admin-nav`,
`.admin-nav-button`, `.admin-back-button`, `.admin-main`, `.admin-topbar`,
`.admin-topbar-actions`, `.admin-user` (storefront.css ~2627–2733); plus
`.analytics-risk-list`, `.analytics-risk-row`, `.analytics-inventory` (~3559–3590);
plus a full customer-management cluster `.customer-management-grid`, `.customer-card`,
`.customer-card-head`, `.customer-kpi-row`, `.customer-avatar`, `.customer-contact`,
`.customer-note` (~9293–9406); plus `.approval-list`, `.approval-row`. None of this
is seller- or admin-app code (those live in their own separate CSS files, §1) — it's
customer-web CSS for screens the customer app doesn't have.

**A fully superseded catalogue implementation**, predating the current `shop-*`
system: `.catalog-page`, `.catalog-hero`, `.catalog-shell`, `.catalog-hero-stat`,
`.catalog-shell-picture-first`, `.catalog-controls`, `.catalog-controls-row`,
`.catalog-results-head`, `.catalog-results-meta`, `.catalog-browsing-summary`,
`.catalog-browsing-label`, `.catalog-browsing-chips`, `.catalog-product-grid`,
`.catalog-empty-state`, `.catalog-empty-actions`, `.catalog-supporting`
(storefront.css ~4214–4422). Note: `.catalog-card-*` (media/body/footer/tags/view) is a
**different, currently-live** family used by the present-day `ProductCard`/`CakeCard`/
`GiftBoxCard` — don't let the shared `catalog-` prefix cause these two unrelated groups
to be confused during cleanup.

**A fully superseded category-showcase naming, predating the current `cat-*`
component:** `.category-tabs`, `.category-tab`, `.category-tab-count`,
`.category-showcase`, `.category-card-link`, `.category-card-link--feature`. The live
component (`CategoryShowcase.jsx`) renders `cat-banner`, `cat-carousel`, `cat-dot`,
`cat-arrow`, `cat-showcase` — a visually-similar but textually distinct naming scheme.
The `category-*` versions are dead.

**A genuine (not blanket) subset of dead `cl-*` rules**, real legacy from
`ClientLayout`'s own past refactors: `.cl-topbar-inner`, `.cl-brand-mark`,
`.cl-brand-name`, `.cl-nav-btn`, `.cl-icon-btn`, `.cl-cart-btn`, `.cl-cart-badge`,
`.cl-sell-btn`, `.cl-signin-btn`, `.cl-user-btn`, `.cl-avatar`. (`.cl-bar1`,
`.cl-account-chip`, `.cl-cart-chip`, `.cl-cart-label`, `.cl-dropdown-*` are live —
don't delete those.)

**Smaller confirmed-dead singles:** `.checkout-steps`, `.checkout-step-card`,
`.app-status`, `.auth-user`, `.app-shell`, `.app-nav`, `.brand-lockup`,
`.button-pair`, `.control-strip`, `.compact-stack`, `.compact-row`, `.commerce-cart`
(also listed above — it has two duplicate definitions per §4b, and *both* are dead),
`.box-custom-fields`, `.cake-shop-name`, `.client-seller-cta`.

**Classification: `remove later`.** High confidence (zero static references), but
"later" because: (a) dynamic class-name construction wasn't checked, (b) deleting
~80 rules across a focused 11,000-line file is exactly the kind of change that should
happen in its own dedicated, easily-revertible commit — not bundled into the structural
migration in §9.

---

## 6. Inline styles in JSX

75 total `style={{...}}` occurrences across `apps/web/src`. Categorized by what they
actually do:

| Category | Count | Verdict |
|---|---|---|
| Sets only CSS custom properties (`--family-tone`, `--cake-color`, `--path-image`, etc.) consumed by a real CSS rule elsewhere | 35 | **Fine** — this is the correct way to parameterize CSS from JS data |
| Sets a real property to a computed/state-dependent value (progress-bar `width`, per-item `animationDelay`, palette-driven `color`/`background`) | 15 | **Mostly fine**, a few are borderline (e.g. `HeroSlider.jsx:271` hardcodes a static rgba that isn't actually computed and should just be a CSS class) |
| Sets a real property to a **fixed value that never changes** — i.e., styling that escaped the CSS files for no data-dependent reason | **25** | **Smell** |

The 25 static-hardcoded occurrences cluster in five files: `AccountPage.jsx` (12),
`ResetPasswordPage.jsx` (9), `OrderConfirmationPage.jsx` (3),
`AuthModal.jsx`/`LoginPage.jsx`/`LegalPage.jsx`/`ClientLayout.jsx` (1 each). Most are
small layout fragments (`{ display: "flex", gap: "0.4rem" }`,
`{ gridColumn: "1/-1" }`) repeated near-identically several times within the same file
— each is a candidate for a small utility class, not a sign of a deep problem, but
worth sweeping up during the **account** phase of the migration (§9, step 7) since
that's exactly where most of them live.

**Classification:** the 35 CSS-variable ones are `keep`. The 25 static ones are
`migrate` (into the CSS files they belong to, page by page, as each page is touched).

---

## 7. RTL (right-to-left) risk

The app is English/LTR-only today: no `dir="rtl"` anywhere, no language switch, no
global `direction` rule. (Isolated `dir="auto"`/`lang="ar"` attributes exist on a couple
of specific Arabic *content* strings — e.g. seller names — but that's a content-level
attribute, not layout support.)

Physical-direction CSS (which breaks or mirrors incorrectly under RTL unless
deliberately re-authored) is the default authoring style throughout:

| File | `margin-left/right` | `padding-left/right` | `text-align: left` | `left:`/`right:` (positioning) | Logical properties used |
|---|---|---|---|---|---|
| `storefront.css` | 10 | 7 | 17 | 68 | 2 (`margin-inline`, `inset-inline`) |
| `client.css` | 2 | 1 | 6 | 16 | 2 (`margin-inline`) |
| `homepage.css` | 6 | 0 | 4 | 15 | 0 |
| `immersive.css` | 0 | 3 | 1 | 4 | 0 |

`packages/shared/styles/base.css` uses `inset-inline-end` once
(`.notification-menu`) — proof the pattern is known in this codebase, just never
repeated. Counts above are from the automated pass; spot-checked the `storefront.css`
`left:`/`right:` figure informally while reading other sections and it's consistent
with what's visible (this file is genuinely saturated with absolute-positioned
decorative elements using physical sides).

**Classification: not a block to classify, a cross-cutting risk.** RTL is not on the
roadmap per anything in this repo today, so there's no urgency to convert physical to
logical properties pre-emptively. The actionable takeaway is narrower: **any CSS
written from today forward** (i.e., everything touched during the migration in §9)
should default to logical properties (`margin-inline-start/end`, `padding-inline-*`,
`inset-inline-*`, `text-align: start/end`) so the migration doesn't make the eventual
RTL bill bigger than it already is.

---

## 8. Media query / breakpoint inventory

| File | Distinct breakpoints | The "real" trio | One-offs |
|---|---|---|---|
| `storefront.css` | 17 | `820px`, `1180px`, `520px` | `1040, 1100, 600, 640, 680, 700, 720, 900, 980, 1400(min)` |
| `client.css` | 6 | `820px`, `520px` | `480, 640, 900, 980` |
| `homepage.css` | 6 | `820px`, `980px` | `480, 580, 640, 1100` |
| `immersive.css` | 2 | — | `640` |

`820px`/`1180px`/`520px` are the closest thing to a deliberate system (they recur most
often and roughly track tablet/small-desktop/mobile). Everything else reads as a
breakpoint picked to fix one specific layout at the moment it was built, not derived
from a shared scale — note that `tokens.css` already defines `--bp-sm: 520px`,
`--bp-md: 820px`, `--bp-lg: 1180px` as "reference only, used in JS" — i.e., the
3-value system *is* canonically defined already, just not consistently honored in the
media queries themselves (which hardcode pixel values rather than referencing these,
since CSS custom properties can't be used inside `@media` conditions without a
build-time preprocessor — that constraint is itself worth knowing if the revamp
considers introducing one).

**Classification: `keep`** the 820/1180/520 trio as the canonical set; treat every
other value encountered during the migration as a `migrate` candidate — replace with
the nearest canonical breakpoint rather than preserving the one-off, unless a real
visual regression proves it's load-bearing.

---

## 9. Shared component vs page-specific — classification of major blocks

| CSS block / family | Where it lives | Classification | Why |
|---|---|---|---|
| `:root` tokens (colors, shadows) | `tokens.css` **and** `storefront.css` | `merge` | Two conflicting sources of truth (§2) |
| `:root` structural scale (spacing/type/radius/z-index/transitions) | `tokens.css` only | `keep` | Single source, uncontested, correctly layered |
| `.eyebrow`, `.primary-action`/`.secondary-action`/`.ghost-action`, `.icon-button` | Defined in **both** `base.css` and `storefront.css` | `merge` | True shared infrastructure (verified: `.eyebrow` 29 files, `.primary-action` 24, `.secondary-action` 20, `.icon-button` 9) but redefined with different property sets in the app layer — collapse to one definition, ideally in `base.css`, with web-specific nuance as a modifier class |
| `.filter-tab` | `base.css` | `migrate` | Generic shared name, but verified used by exactly 1 page (`FragranceFinderPage`). Either rename to something scoped, or genuinely promote it to shared if more pages are expected to need it — current state is misleading either way |
| `.status-badge`, `.metric-card`, `.notification-*`, `.risk` | `base.css` | `page-specific` (to seller/admin, not customer) | Vocabulary is escrow/payout-hold/dispute-hold/approval-state — seller/admin business concepts shipped into every customer page load for no customer-facing benefit. Candidate to split `base.css` into a true cross-app layer + per-app extensions |
| `.bottle-art`, `.star-picker`/`.star-button` | `base.css` | `shared component` | Correctly scoped, single component each, generic names justified |
| `.empty-state` (generic) vs `.shop-empty-state`/`.build-box-empty-state`/`.account-empty-state`/`.collection-empty-state` | `base.css` generic; `storefront.css`/`client.css` page-scoped variants | `keep` | This is the pattern done *right* — verified every page with an empty state defines its own prefixed variant rather than leaning on the generic one. Use this as the template for fixing the buttons/eyebrow situation above |
| `CommerceHeader`/`HeroShowcase` CSS cluster (§5) | `storefront.css` ~77–433 | `remove later` | Tied to two confirmed-orphaned components |
| Admin/seller-flavored block (§5) | `storefront.css` ~2627–2733, ~3559–3590, ~9293–9406 | `remove later` | Wrong app entirely |
| Legacy `catalog-*` page (§5) | `storefront.css` ~4214–4422 | `remove later` | Superseded by `shop-*` |
| Legacy `category-*` showcase naming (§5) | `storefront.css` (scattered) | `remove later` | Superseded by `cat-*` |
| Dead `cl-*` subset (§5) | `client.css` | `remove later` | Real legacy from `ClientLayout`'s own history |
| `home-*`, `trust-closing`, `featured-product-*` double-definitions (§4b) | `storefront.css` | `merge` | Same selector, 2–4 definitions, only the last matters |
| `.finder-layout`, `.sitemap-card` family, `.featured-product-card` (§4a) | `client.css` ↔ `storefront.css` ↔ `homepage.css` | `merge` | Cross-file duplicates, several with hover/variant sub-rules duplicated too |
| `shop-*` (Shop/catalogue page) | `storefront.css` (current, ~4424–5170) | `keep` | Current, actively maintained, single coherent block — the "good example" of what a feature's CSS should look like in this codebase |
| `build-box-*` | `storefront.css` | `keep` | Same — coherent, single-owner block, no internal duplication found |
| `gifting-shortcuts`/`shortcut-*` | `homepage.css` | `keep` | Newest addition, no duplication, already follows the logical-property-friendly conventions where practical |
| `is-*` (immersive hero) | `immersive.css` | `keep` | Self-contained, no cross-file collisions found beyond two intentional shared-name overrides (`.is-copy`, `.is-cta`) |
| Account / legal / journal / order-confirmation blocks | `storefront.css` (~7155–8062, ~5894–6022) | `page-specific` | Correctly single-owner today; main issue is the inline-style sprawl (§6), not CSS architecture |
| Inline static styles (§6) | JSX, 5 files | `migrate` | Into page-scoped CSS classes |

---

## 10. Proposed migration order

The smallest-safe-step ordering requested, with what "done" means at each step and
what NOT to touch yet:

### 1. Tokens / base
- Reconcile `tokens.css` vs `storefront.css` `:root` (§2) into one canonical color +
  shadow set. Decide which hex values are "correct" (likely the `storefront.css`
  values, since they're what's actually been visually approved across this whole
  design cycle) and update `tokens.css` to match, then delete the duplicate `:root`
  block from `storefront.css` entirely.
- Merge `.eyebrow`/`.primary-action`/`.secondary-action`/`.ghost-action`/
  `.icon-button` into one definition each (§9).
- Do **not** touch the admin/seller-flavored portion of `base.css` yet — confirm with
  `apps/seller`/`apps/admin` usage first, since that's outside this audit's scope.
- This step touches the file every other page depends on — verify visually across
  *all* pages before moving on, not just one.

### 2. Header
- Delete the confirmed-orphaned `CommerceHeader.jsx`/`HeroShowcase.jsx` and their CSS
  cluster (§5) — pure deletion, zero behavior change, lowest-risk step in the whole
  plan.
- Resolve the `.featured-product-card` triple-definition (§4a) since it touches
  `client.css` (the topbar/header file) directly.
- Leave the live `cl-*` topbar system in `client.css` itself alone structurally; this
  step is about clearing the dead wood around it, not redesigning it.

### 3. Homepage
- Already the most recently and carefully worked section this cycle (`gifting-shortcuts`,
  `shop` rails, `trust-closing`, `FinalCTA`) — lowest incremental risk of the
  page-specific work.
- Collapse the `.home-page`/`.home-content`/`.trust-closing` duplicate pairs (§4b) into
  single definitions now that this cycle's design work on them is settled.
- Resolve `homepage.css` ↔ `storefront.css` cross-file overlaps (`.boutique-discovery`,
  `.editorial-link-image`, and the ~12 more like them) by deciding one owner file per
  class and deleting the other definition.

### 4. Shop
- `shop-*` is already a clean, single-owner block (§9) — this step is mostly about
  confirming the legacy `catalog-*` page (§5) is truly unreachable, then deleting it,
  not about restructuring anything live.

### 5. Product detail
- `ProductPage.jsx` is a 1-line re-export of `ProductDetailPage.jsx` (same pattern as
  `ShopPage.jsx` → `StorefrontPage.jsx`) — both files are legitimately live, this is
  not a `CommerceHeader`/`HeroShowcase`-style orphan. No action needed on that front.
- Not separately deep-audited in this pass beyond confirming the above. Resolve any
  `catalog-card-*` vs `product-detail-*` naming overlap found while in there.

### 6. Purchase flow (cart / checkout / order confirmation)
- `.checkout-steps`/`.checkout-step-card` are confirmed dead (§5) — delete first.
- `.order-confirmation-panel`/`.checkout-summary-card` duplicate pairs (§4b) — merge.
- Move the `OrderConfirmationPage.jsx` static inline styles (§6) into CSS as part of
  this step, since you're already in the file.

### 7. Account
- Highest concentration of static inline styles (§6: `AccountPage.jsx` 12,
  `ResetPasswordPage.jsx` 9) — this is the step where §6's cleanup pays off most.
- `.account-empty-state` already follows the correct scoped-empty-state pattern (§9) —
  no change needed there, just use it as the reference pattern for the inline-style
  cleanup.

### Sequencing notes that apply across all seven steps
- Do the `remove later` deletions (§5) **as their own commits**, separate from any
  `merge`/`migrate` work in the same area, so a regression is trivially bisectable to
  "we deleted something that was secretly still used" vs "we changed a value."
- Because `client.css` wins every cascade collision today (§3), any step that touches
  both `client.css` and another file should land the `client.css` change last and
  re-verify visually — a `client.css` edit can silently change how an unrelated page
  renders.
- Write all new/touched CSS using logical properties (§7) going forward, without
  doing a dedicated RTL pass — there's no product requirement for it yet, but every
  migrated rule is a rule that won't need to be revisited later.
