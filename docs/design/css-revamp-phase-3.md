# CSS Revamp Phase 3 — Homepage CSS Consolidation

**Status:** Structural consolidation only. No section redesigned, no copy
changed, no homepage structure changed, no routes changed. Nothing committed,
nothing staged by this phase.

## Pre-flight — working tree at the start of this phase

```
 M apps/web/src/App.jsx
 M apps/web/src/features/homepage/AdaptiveProductEdit.jsx
 M apps/web/src/features/homepage/homepage.css
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
```

`storefront.css`, `tokens.css`, and `css-revamp-phase-1.md` were already
**staged** (`git add`-ed by someone outside this phase) before this phase
began. This phase did not run `git add`/`git reset`/`git stash`/`git
restore` at any point — that staged state is exactly as found. This phase's
own edits to `storefront.css` are additional unstaged changes on top of it
(hence `MM`).

## Task A/B — Selector ownership map

Every live homepage component was read directly (not delegated to a research
agent, given Phase 0/2's experience with extraction errors on multi-class
strings) to get an exact class inventory, then cross-referenced against all
four CSS files plus `base.css`.

| Component | Classes (representative, not exhaustive) | Current location | Classification |
|---|---|---|---|
| `ImmersiveStory.jsx` | `is-hero`, `is-story`, `is-images`, `is-image(--active)`, `is-gradient`, `is-body`, `is-copy`, `is-kicker`, `is-headline`, `is-invite`, `is-cta`, `is-cards`, `is-card(-num/-title/--active)`, `is-pause-btn` | `immersive.css` (sole owner) | **immersive-owned** — clean, no duplication beyond the `.is-copy` conflict fixed in Task C |
| `GiftingShortcuts.jsx` | `gifting-shortcuts*`, `shortcut-tile`/`--ai`/`--brand`, `shortcut-icon`, `shortcut-copy/-title/-helper` | `homepage.css` (sole owner) | **homepage-owned** — already clean (written this design cycle, no legacy duplication) |
| `PathSelector.jsx` | `path-selector`, `path-section-head`, `path-grid`, `path-card-link` (+7 modifiers), `path-card-kicker`, `path-card-cta` | `storefront.css` only (single rule per selector — verified, not duplicated) | **homepage-owned content, wrong file** — documented, not relocated (see §"Deferred relocation" below) |
| `GiftBuilderPreview.jsx` | `gift-preview*`, `gift-preview-head/-steps/-step(-num)/-primary-action/-secondary(-action)` | `storefront.css` only | **homepage-owned content, wrong file** — deferred, same reasoning |
| `AdaptiveBoutique.jsx` | `boutique-discovery(-inner)`, `boutique-campaign*`, `boutique-split*`, `boutique-trio*`, `boutique-section-header`, `boutique-loading-*`, `featured-seller-*` (rail/card/media/shell/intro/gallery/grid/copy/watermark/badge/pill/link) | `homepage.css` (base rules) + `storefront.css` (descendant/pseudo-class polish only — verified, not base duplicates, except `.boutique-campaign-name`'s letter-spacing which is additive not conflicting) | **homepage-owned**, base styles already single-sourced correctly |
| `AdaptiveProductEdit.jsx` | `featured-product-rail*`, `featured-product-shell--split`, `featured-product-intro`, `featured-product-strip(-arrows)`, `featured-product-arrow(--disabled)`, `featured-product-card`, `featured-product-media(--image)`, `featured-product-art`, `featured-product-pill(--badge)`, `featured-product-copy/-heading/-shop-line/-tags/-footer/-price/-link`, `product-editorial*`, `product-split*`, `product-trio*` | `homepage.css` (carousel/editorial/split JSX-interaction rules) + `client.css` (`featured-product-card` base visuals, `featured-product-media`, `featured-product-grid`, responsive) | **homepage-owned content split across 2 files** — `.featured-product-card` duplicate (within `client.css`) merged in Task C; broader family-level relocation to `homepage.css` deferred (see below) |
| `OccasionJourney.jsx` | `occasion-stage`, `occasion-heading`, `occasion-panels`, `occasion-panel` (+4 modifiers), `occasion-panel-bg(-fallback)`, `occasion-seasonal-label`, `occasion-copy/-eyebrow/-title/-desc/-cta` | `homepage.css` (base rules) + `storefront.css` (descendant `h2` letter-spacing + `:focus-visible` only — additive, not conflicting) | **homepage-owned**, base styles already single-sourced correctly |
| `EditorialDiscovery.jsx` | `editorial-discovery(-inner/-head)`, `editorial-links`, `editorial-link`, `editorial-link-image(-fallback)`, `editorial-link-copy/-label/-desc/-arrow` | `homepage.css` (base) + `storefront.css` (descendant `h2`, `:focus-visible`, **and** a real `aspect-ratio` conflict — fixed in Task C) | **homepage-owned**, one real conflict found and resolved |
| `TrustClosing` (inline in `HomePage.jsx`) | `trust-closing(-inner/-head/-label)`, `trust-grid`, `trust-item`, `trust-icon-circle` | `storefront.css` only — but **`.trust-closing` itself had two separate standalone definitions in the same file**, fixed in Task C | **homepage-owned content, wrong file** (deferred relocation) + **real duplicate** (fixed) |
| `FinalCTA.jsx` | `final-cta(-inner)`, `final-cta-eyebrow/-sub/-actions/-primary/-secondary` | `homepage.css` (sole owner) | **homepage-owned** — already clean |
| `CategoryShowcase.jsx` (`cat-*`) | Not imported by `HomePage.jsx` at all | n/a | **not part of the live homepage** — out of scope for this phase, noted for completeness |
| Homepage shell (`HomePage.jsx` itself) | `home-page`, `home-content`, `home-section` | Was duplicated **twice within `storefront.css`** | **real duplicate** (fixed in Task C, moved to `homepage.css` as the new sole owner — clean architectural fit since it's the literal homepage shell) |
| Shared/protected (used by multiple homepage components, must not be touched) | `eyebrow`, `primary-action`, `secondary-action`, `ghost-action`, `icon-button`, `home-section` (generic layout helper used by 4+ components) | `base.css` / `storefront.css` per Phase 1's findings | **shared component / global utility** — untouched |

### A methodology note that changed the scope of this phase

The first pass cross-referenced ~150 homepage class names against
`homepage.css`/`storefront.css` using a regex that matched a class name
followed by a space, brace, comma, period, or colon. That regex over-matched:
`.boutique-discovery h2` (a descendant selector styling an `<h2>` *inside*
`.boutique-discovery`) looks identical to a real redefinition of
`.boutique-discovery` itself under that pattern, and so does
`.occasion-panel:focus-visible` (a pseudo-class-only supplement) versus a
real base-style conflict. Of an initial list of **12 candidate cross-file
duplicates**, **9 turned out to be false positives** — legitimate, narrowly-
scoped "polish pass" rules (letter-spacing, focus-visible outlines) living in
storefront.css's "PROFESSIONAL FINISHING PASS" section that *add* properties
without conflicting with the base definition in `homepage.css`. Only by
reading the full surrounding context of every candidate (not just the regex
match) were the 3 *real* conflicts — `.editorial-link-image`'s `aspect-ratio`,
`.trust-closing`'s `background`, and `.is-copy`'s `animation` duration — and
the `.home-page`/`.home-content`/`.home-section` and `.featured-product-card`
true duplicates distinguished from the 9 harmless look-alikes. This is the
same class of mistake Phase 0's automated audit made in the opposite
direction (undercounting via multi-class-string blindness) — recorded here
so a future pass doesn't trust a bare grep count either way.

## Task C — Duplicates actually consolidated

| Selector | Where it was duplicated | Conflict? | Resolution |
|---|---|---|---|
| `.home-page` | Twice in `storefront.css` (base rule, then a "HOMEPAGE RECONSTRUCTION OVERRIDES" rule) | Yes — `background` set twice, second wins | Merged effective style, moved to `homepage.css` as new "Homepage shell" section; both `storefront.css` copies removed |
| `.home-content` | Twice in `storefront.css` (base + 2 separate `@media (max-width: 820px)` blocks for the same selector) | Yes — `width`/`gap`/`padding-bottom` each set in 2+ places | Merged effective style + merged the two 820px overrides into one, all moved to `homepage.css`; all `storefront.css` copies removed |
| `.home-section` | Twice in `storefront.css` | Yes — `gap` set twice | Merged, moved to `homepage.css` |
| `.featured-product-card` (+`:hover`) | Twice **within `client.css` itself** (not cross-file) | Yes — `background`/`border-radius`/`box-shadow` each set twice | Merged effective style into the first definition; second removed. Kept in `client.css` (see "deferred relocation" — moving the whole family was judged too large/risky for this pass) |
| `.editorial-link-image` | `homepage.css` (base) + `storefront.css` (one-property override) | **Yes — real conflict**: `aspect-ratio: 3/4` (homepage.css) vs `2/3` (storefront.css). Per the audit's confirmed production cascade order, storefront.css loads after homepage.css, so `2/3` was the actual effective value | Merged into `homepage.css` with the correct (`2/3`) value; `storefront.css` copy removed |
| `.trust-closing` | Two **separate standalone rules in `storefront.css`** (one under "Trust closing", one under "Section transition: editorial discovery → trust") | **Yes — real conflict**: `background: var(--paper)` vs `background: linear-gradient(...)`. Second wins | Merged into one rule (kept in `storefront.css`, see deferred relocation); also converted its 3-value `padding` shorthand to `padding-block`/`padding-inline` (Task G) |
| `.is-copy` | `immersive.css` (base) + `storefront.css` (one-property override) | **Yes — real conflict**: `animation: is-copy-in 420ms` vs `520ms`. storefront.css loads after immersive.css, so `520ms` was effective | Merged into `immersive.css` with the correct (`520ms`) value; `storefront.css` copy removed |

**9 false-positive "duplicates"** (descendant selectors or pseudo-class-only
supplements, not touched): `.boutique-discovery`, `.boutique-campaign-cta`,
`.boutique-campaign-name`, `.boutique-split-panel`, `.occasion-heading`,
`.occasion-panel`, `.editorial-discovery-head`, `.editorial-link`,
`.product-editorial-btn`, `.product-split-card` (10 listed — the letter-
spacing/focus-visible "PROFESSIONAL FINISHING PASS" rules covering these
selectors were read in full and left untouched).

**Bonus findings while reading the full finishing-pass section**, removed
because they sat directly adjacent to the real `.is-copy` conflict and were
independently fresh-verified as dead (zero JSX consumers), not because this
phase went looking for dead code generally:
- `.is-frame`, `.is-progress-bar` — confirmed unused by current
  `ImmersiveStory.jsx`, removed from `storefront.css`.
- `.home-section-head` (`storefront.css`) — confirmed unused, but **left in
  place**: it wasn't directly entangled with anything this phase was already
  editing, so removing it was judged out of this phase's scope (that's a
  Phase 2-style deletion task, with its own verification rigor, not a Phase 3
  consolidation).

## Task D — Preserved behaviors (verified, not just assumed)

All of the following were screenshotted before concluding the phase and
match the pre-Phase-3 appearance: immersive hero slider and its 6s
auto-advance/pause mechanics (untouched — only `.is-copy`'s animation
*duration* changed, and that duration was already the effective production
value, so nothing actually changed visually), Gifting Shortcuts overlap and
layout, Path Selector, Gift Builder Preview, featured product rails
(including the carousel arrows and scroll behavior — untouched JS, and the
one CSS merge only consolidated already-effective values), boutique
discovery, occasion discovery, editorial section, trust section (background
gradient now explicit rather than cascade-dependent, same pixels), final CTA
(the "Ready to gift?" eyebrow contrast fix from earlier this design cycle is
unaffected — different selector, not touched). No oversized intro block, no
Arabic text, no box-in-box product rails, no table-style trust layout, and
the final-CTA eyebrow remains readable — none of these regressions were
reintroduced (confirmed visually at all 4 breakpoints).

## Task E — Reconstruction layering

Comments such as "HOMEPAGE RECONSTRUCTION OVERRIDES" and "PROFESSIONAL
FINISHING PASS" were not deleted wholesale — they still accurately describe
real content this phase didn't move (Path Selector, Gift Builder Preview,
the deferred `.trust-closing-*` family, the boutique/occasion/editorial
polish touches). Where a selector's duplication was fully resolved, the
"second" copy was replaced with a one-line pointer comment back to its new
home rather than left as silent dead air, and the merged rule itself carries
a short note explaining *why* a given value was chosen when it came from
resolving a conflict (e.g. "2/3 was the effective value, not 3/4"). This
matches the spirit of "replace chronological comments with ownership
comments" without rewriting comments on content this phase didn't actually
touch.

## Task F — Responsive consolidation

Only one true cross-location responsive duplicate was found and fixed:
`.home-content`'s `@media (max-width: 820px)` rule existed in **two separate
`820px` blocks** in `storefront.css` (one setting `width`, a different one
later in the file setting `gap`/`padding-top`). Both were merged into a
single `@media (max-width: 820px) { .home-content { ... } }` block, placed in
`homepage.css` directly under the new "Homepage shell" rules. No other
homepage selector was found duplicated across breakpoints. No broad
breakpoint rewrite was performed — the existing 1180/820/520 (and the
homepage-specific 1100/980/580/480/640 ones already in `homepage.css`) were
left exactly as they were, since none of them were shown to cause a
verified regression by changing.

## Task G — Logical properties

Applied only to rules this phase actually touched (no broad rewrite):
`.trust-closing`'s 3-value `padding` shorthand (`clamp(...) clamp(...)
clamp(...)`, i.e. top / left+right / bottom) was converted to
`padding-block: <top> <bottom>; padding-inline: <left-right>;` — value-
identical, zero visual change, now logical-property-correct for a future
RTL pass. No other touched rule had a directional property worth converting
(most were `background`, `animation`, `aspect-ratio`, `gap`, `width` — none
of which have a meaningful logical-property form). No decorative positioning
was mirrored or otherwise RTL-migrated.

## Task H — Size and dependency check

| Metric | Before Phase 3 | After Phase 3 | Change |
|---|---|---|---|
| `homepage.css` lines | 1,539 | 1,578 | +39 (new shell section + explanatory comments + merged responsive block) |
| `storefront.css` lines | 10,244 | 10,210 | −34 |
| `client.css` lines | 2,513 | 2,507 | −6 |
| `immersive.css` lines | 391 | 394 | +3 (comment + merged duration) |
| Confirmed real duplicate/conflicting selectors found | 3 (named in the brief) + several more discovered while reading | **0 remaining** for the 7 specific selectors addressed (see Task C table) | — |
| Customer web CSS bundle (raw) | 235.61 kB | 234.99 kB | −0.62 kB |
| Customer web CSS bundle (gzip) | 41.20 kB | 41.14 kB | −0.06 kB |
| Other 4 apps | unchanged | unchanged | 0 bytes (no files outside `apps/web` touched) |

The net line count is roughly flat by design — this phase traded duplicate
rules for explanatory comments documenting *why* a value was chosen, which
was judged more valuable than a larger line-count reduction with no
explanation. Task H is explicit that "the goal is cleaner ownership, not
maximum deletion," and the bundle-size delta here is intentionally modest.

## Deferred relocation (documented, not executed)

Per the brief's own conservative framing ("do not redesign," "the goal is
cleaner ownership, not maximum deletion," preserve "do not simply copy the
last rule blindly") and this design cycle's established risk posture (Phase
1 and 2 both deferred high-blast-radius moves rather than force them through
in one pass), this phase's *physical* file-to-file relocation was scoped to
confirmed duplicates/conflicts only. The following are real,
single-occurrence, homepage-exclusive selectors that the new ownership rules
(Task B) say *should* eventually live in `homepage.css`, but currently live
in `storefront.css`/`client.css` as their sole, internally-consistent
definition:

- `.path-*` (Path Selector — ~11 rules, `storefront.css`)
- `.gift-preview*` (Gift Builder Preview — ~10 rules, `storefront.css`)
- `.trust-closing-inner/-head/-label`, `.trust-grid`, `.trust-item`,
  `.trust-icon-circle` (Trust section body — `storefront.css`)
- The bulk of `.featured-product-*` and `.featured-seller-*` (product rails
  and boutique gallery — `client.css`, heavily interleaved with shared
  responsive blocks at `820px`/`980px`)

None of these have a duplication problem — each is defined exactly once and
internally consistent. Moving them is a pure ownership/organization
improvement, not a correctness fix, and each one sits inside larger
multi-selector responsive blocks shared with other content (the same
entanglement pattern that required surgical care in Phase 2). Recommended as
Phase 4 work, one family at a time, each with its own before/after visual
diff — not bundled into this pass.

## Verification

- `git diff --check` — clean.
- `npm run test:critical-smoke` — 5/5 pass.
- `npm run build` — all five workspaces build clean.
- Homepage, Shop, and Cart all loaded in-browser with 0 console errors and
  0px horizontal overflow.
- Full-page screenshots captured at 375px, 768px, 1280px, and 1440px — no
  overflow, no errors, all sections present in the original order.
- Section-level zoom screenshots compared against this design cycle's
  earlier verified state for: hero + Gifting Shortcuts, the luxury-picks
  product rail, boutique discovery, editorial discovery, trust section, and
  final CTA — all visually equivalent.
- `:focus-visible` confirmed functional on the homepage header via
  `document.activeElement.matches(':focus-visible')` after tabbing.
- No selector used by Shop, product detail, cart, checkout, account,
  seller, admin, driver, or SR was touched — every edit in this phase was
  verified against a live JSX consumer list before being made, and the two
  edits outside `apps/web` core files (`immersive.css`) were both purely
  homepage-hero-internal.

## Pre-existing work preserved

All 18 items in the pre-flight list are still present after this phase. This
phase's own changes: `homepage.css`, `storefront.css`, and `client.css`
further modified (on top of their pre-existing modifications, not in place
of them); `immersive.css` newly modified; this document added. The staged
state of `storefront.css`/`tokens.css`/`css-revamp-phase-1.md` from before
this phase was not disturbed — this phase did not stage or commit anything.

## Remaining homepage CSS debt

- The four deferred-relocation families above (§"Deferred relocation").
- `.home-section-head` (`storefront.css`) — confirmed dead, not removed this
  phase (out of scope, see Task C notes).
- Everything Phase 0's audit already flagged that this phase didn't touch:
  cross-file duplicates like `.finder-layout`/`.sitemap-card`/
  `.featured-product-card`'s focus-visible-only entanglement with
  `.featured-seller-card`/`.product-split-card`, the button-trio radius/
  weight divergence from Phase 1, the eight still-undefined CSS variables
  (`--sand`, `--cream`, `--nile`, `--page-x`, `--body`, `--shadow-lg`,
  `--sp-7`, `--sp-13` — explicitly not defined this phase, per the brief).

## Phase 4 recommendation

1. Relocate the four deferred families (§"Deferred relocation") to
   `homepage.css`, one at a time, each as its own reviewable change with
   its own before/after screenshot set — start with `.path-*` and
   `.gift-preview*` (smallest, least entangled with shared responsive
   blocks) before attempting the larger `.featured-product-*`/
   `.featured-seller-*` move.
2. Once those land, `storefront.css`'s "HOMEPAGE RECONSTRUCTION OVERRIDES"
   and "PROFESSIONAL FINISHING PASS" section headers will have nothing
   homepage-specific left under them — delete the headers themselves at
   that point, not before.
3. Apply the same fresh-context-reading methodology from this phase (not a
   bare grep count) to Shop/product-detail/checkout/account CSS, which
   Phase 0's audit flagged but never got the same selector-by-selector
   treatment homepage.css just received.
