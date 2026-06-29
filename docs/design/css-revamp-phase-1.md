# CSS Revamp Phase 1 — Canonical Tokens and Shared Foundations

**Status:** Architectural only. No pages redesigned, no layouts changed, no routes
changed, no backend touched. Nothing committed.

**Pre-existing working tree at the start of this phase** (preserved, untouched, all
still present after this phase — see §8):

```
 M apps/web/src/App.jsx
 M apps/web/src/features/homepage/AdaptiveProductEdit.jsx
 M apps/web/src/features/homepage/homepage.css
 M apps/web/src/features/layout/ClientLayout.jsx
 M apps/web/src/features/pages/BuildYourBoxPage.jsx
 M apps/web/src/features/pages/HomePage.jsx
 M apps/web/src/features/storefront/StorefrontPage.jsx
 M apps/web/src/styles/client.css
 M apps/web/src/styles/storefront.css
 M apps/web/vite.config.js
 M docs/bmad/D0.1-design-quality-checklist.md
 M docs/bmad/D0.2-screen-audit-reports.md
?? apps/web/src/features/homepage/GiftingShortcuts.jsx
?? apps/web/src/features/storefront/components/ShopFilterDrawer.jsx
?? apps/web/src/features/storefront/components/ShopToolbar.jsx
?? docs/design/
```

These are all from prior, separate work this design cycle (Shop page rebuild, homepage
shortcuts launcher, Build-a-Box polish, the Phase 0 audit). None of it was staged,
reset, or discarded. `storefront.css` already being modified meant this phase's edits
to it landed on top of those changes, not in place of them.

---

## 1. Original token conflict (recap + one new discovery)

Phase 0 (`docs/design/css-revamp-audit.md`) found that `apps/web`'s
`storefront.css` carried its own unscoped `:root` block that redeclared every color
and shadow token `packages/shared/styles/tokens.css` defines, with different values,
and — because it loads later — always won.

**New for this phase:** the same investigation was repeated for `apps/admin` and
`apps/seller`, which were flagged as "out of scope" in Phase 0. Both **also** carry
their own unscoped `:root` block, and both are **byte-for-byte identical** to
`storefront.css`'s — same hex values, same shadow shapes, to the last character. The
driver and SR apps have no local override at all; they were rendering `tokens.css`'s
original values directly.

This means `tokens.css` was never "the customer app's stale copy" — it was the **one
file the whole monorepo had forgotten to update** after three of five apps
independently (most likely via copy-paste, not independent redesign) converged on a
refined palette. Driver and SR were the only two apps still rendering the old values.

| Token | Old `tokens.css` | Web / Admin / Seller (already identical) | Driver / SR (rendered old value pre-Phase-1) |
|---|---|---|---|
| `--brand` | `#0f6f61` | `#005c46` | `#0f6f61` → now `#005c46` |
| `--brand-dark` | `#0b4e47` | `#013d32` | `#0b4e47` → now `#013d32` |
| `--ink` | `#15201d` | `#171717` | `#15201d` → now `#171717` |
| `--paper` | `#f7faf8` (cool) | `#fbf7ef` (warm) | `#f7faf8` → now `#fbf7ef` |
| `--blue`/`--info` | `#2d6cdf` (actually blue) | `#1b8a7a` (actually teal) | `#2d6cdf` → now `#1b8a7a` |
| `--danger` | `#b42318` | `#9f5139` | `#b42318` → now `#9f5139` |
| shadow shapes | `0 4px 12px …` style (4 of 5 differ in blur/offset, not just color) | `0 6px 16px …` style | old shape → now matches web/admin/seller |

---

## 2. Canonical token decision

**Decision: adopt the web/admin/seller-converged values as the canonical set in
`tokens.css`.** Rationale:

- Three of five apps already render these values today — this is the
  strongest available signal of "approved," not a guess.
- The structural scale (spacing, type, radii, z-index, transitions, breakpoint
  references) was **not** part of the conflict — `storefront.css` never redefined
  those, so they were already correctly sourced from `tokens.css` alone. Verified by
  grepping all four web-app CSS files for `--sp-`, `--text-`, `--radius`, `--z-`,
  `--t-`, `--bp-`, `--max-width` at `:root`-declaration position: zero matches outside
  `tokens.css`.

This was treated as a "verified conflict" under the brief's own rule ("preserve
currently approved effective values unless there is a verified conflict") — the
conflict being that `tokens.css` itself was wrong relative to what three live apps had
already shipped and were presumably already signed off on.

### What was NOT done, and why

The brief's preferred architecture allows **app-level semantic aliases under an app
root class** when brand values genuinely differ. That mechanism was **not needed** —
investigation showed there is no genuine current brand divergence to preserve. Web,
admin, and seller already match exactly; driver and SR had no intentional separate
identity, just a stale shared source. Introducing aliases would have created
machinery for a distinction that doesn't exist in the approved designs.

---

## 3. Web-specific aliases introduced

**None.** Not needed — see §2.

---

## 4. Shared-app impact analysis

| App | Has own `:root` override? | Effect of this phase |
|---|---|---|
| `apps/web` (customer) | Yes (removed this phase, §5) | None — values unchanged, just now sourced from one place instead of two |
| `apps/admin` | Yes, in `admin-dashboard.css` (left untouched — not an approved file this phase) | **Zero visual change.** Confirmed by building and grepping the output: `--brand:#005c46` present before and after, because admin's own override continues to win regardless of what `tokens.css` says |
| `apps/seller` | Yes, in `seller.css` (left untouched) | **Zero visual change**, same reasoning, confirmed the same way |
| `apps/driver` | No | **Real, intentional change.** Driver now renders the same brand/ink/paper/danger/etc. as web/admin/seller instead of the old stale palette. Confirmed via build: `--brand:#005c46`, `--ink:#171717`, `--paper:#fbf7ef`, `--gold:#d7a84a`, `--danger:#9f5139` all present in driver's built CSS post-change |
| `apps/sr` | No | Same as driver — same confirmed change |

Driver and SR were visually spot-checked (login screens, screenshotted) after the
change — both render cleanly, the brand color reads as a normal dark-forest-green
button/icon fill, no broken contrast, no layout shift. See §6.

**This is the one place this phase has a real, non-zero visual effect outside
`apps/web`.** It is a deliberate, documented decision, not a silent one — flagging it
explicitly per the brief's instruction not to silently change dashboard colors. Admin
and seller are dashboards too, and they are provably unaffected; driver and SR are the
apps that change, and the change brings them *into* consistency with the other three
rather than out of it.

---

## 5. Files changed

| File | Change |
|---|---|
| `packages/shared/styles/tokens.css` | Color and shadow values in the `:root` block updated to the canonical (web/admin/seller-matching) set. Structural tokens (spacing/type/radius/z-index/transitions/breakpoints/layout) untouched — already canonical. |
| `apps/web/src/styles/storefront.css` | Removed the entire duplicate unscoped `:root` block (29 custom properties + 3 direct declarations). Removed one redundant standalone `.eyebrow` rule (verified byte-identical to `base.css`'s). Both removals replaced with an explanatory comment, not silently deleted. |
| `docs/design/css-revamp-phase-1.md` | This file. |

`packages/shared/styles/base.css` was **not** modified — see §6 for why.
No app's CSS-import entry file (`main.jsx`) needed changing — import order was
unaffected by this phase.

---

## 6. Shared atom ownership decisions (Task D)

Audited `.eyebrow`, `.primary-action`, `.secondary-action`, `.ghost-action`,
`.icon-button` across all five apps' CSS (not just web):

| Class | Consumers found | Decision |
|---|---|---|
| `.eyebrow` | Redefined only in `storefront.css`, byte-identical to `base.css`. No admin/seller/driver/SR redefinition. | **Removed the web duplicate.** Zero-risk — verified character-for-character identical before deleting. |
| `.primary-action` / `.secondary-action` / `.ghost-action` | `base.css` (shared default), **and independently redefined** in `storefront.css`, `admin-dashboard.css`, **and** `seller.css`. Admin and seller's redefinitions are byte-identical to each other but differ from both `base.css`'s and web's: they use `border-radius: var(--radius-md)` (12px) and `font-weight: var(--fw-semibold)` (600), where `base.css` defaults to `var(--radius)` (8px) and `font-weight: 800`. Web's own redefinition also uses `var(--radius-md)` but does *not* match admin/seller's font-weight (web inherits 800 from base.css since web's override doesn't touch font-weight at all), and additionally changes `gap` to a hardcoded `0.45rem` instead of the `var(--sp-2)` token, and overrides `transition` to a different timing/property list. | **Not consolidated this phase.** There is a genuine, already-shipped, three-way divergence (base default vs. web vs. admin+seller) in radius and weight, not a copy-paste accident. The brief is explicit: don't force customer-web styling onto dashboards, and don't unify when values genuinely differ. Untangling this safely requires first separating `storefront.css`'s combo selector (`.nav-button, .filter-tab, .icon-button, .primary-action, .secondary-action, .ghost-action`) into one rule per class, since editing the combo today risks changing `.nav-button`/`.filter-tab` behavior as a side effect of touching the button trio. That untangling is a Phase 2 task (§9), not a safe same-day edit. |
| `.icon-button` | `base.css` (shared default), redefined in `storefront.css` (web-only — admin only adds `.icon-button.success`/`.icon-button.danger` *modifiers*, which is the correct additive pattern, not a competing redefinition). Web's redefinition changes border-radius to `var(--radius-md)`, same divergence pattern as above, and adds a `.icon-button.primary` variant that doesn't exist in `base.css` at all. | **Not consolidated.** Same radius divergence as the button trio; `.icon-button.primary` is a genuinely new, currently web-only capability, left in place rather than promoted (this phase doesn't add new shared surface, only consolidates existing duplication). |

**States preserved, confirmed unedited:** hover, `:focus-visible`, `:active`,
`:disabled` rules for all five classes were read in every file that defines them and
none were touched. The cross-app shared `:focus-visible` foundation in `base.css`
(the `:where(button, a, input, …):focus-visible` rule) was left exactly as-is.

**One deferred opportunity, not executed:** that shared focus-visible rule hardcodes
`rgba(0, 92, 70, 0.52)` / `rgba(0, 92, 70, 0.12)`, which now numerically equals
`var(--brand)` at the new canonical value. Replacing the literal with a token
reference would be pure technical debt cleanup with no visual change — but it's the
single most cross-app-critical accessibility rule in the codebase (every interactive
element in all five apps depends on it), so it was deliberately left untouched this
phase rather than risk it on a "since I'm here" basis. Recommended as a dedicated,
single-line Phase 2 change with its own visual focus-ring check, not bundled here.

**44px minimum target check:** `base.css`'s shared `min-height: 2.5rem` for the
button trio is **40px, not 44px**. This is pre-existing and was not introduced or
changed by this phase — resizing it would be a real layout change across every app,
which is explicitly out of scope ("do not change layouts"). Flagged here as a finding
for product/design sign-off, not silently corrected.

---

## 7. Variables retained for backward compatibility / deferred naming cleanup

No renames were performed (per the brief: "Do not rename these classes in Phase 1" /
"Prefer maintaining existing names"). Nothing needed a compatibility alias because no
canonical name changed — only values changed, and only for names that already existed
identically in both the old and new source.

Deferred naming items for Phase 2 documentation (not executed):
- `--blue` and `--info` resolve to the same teal value (`#1b8a7a`) under the same
  name's literal English meaning being misleading ("blue" renders teal). Worth a
  Phase 2 conversation about whether `--blue` should be deprecated in favor of always
  using `--info`, rather than carrying two names for one color indefinitely.
- The button-trio/icon-button radius and weight divergence (§6) should eventually
  become explicit semantic tokens (e.g. `--action-radius`, `--action-weight`) rather
  than each app silently overriding the shared default — but only after the
  `storefront.css` combo-selector untangling described in §6/§9.

---

## 8. Pre-existing working-tree changes preserved

Confirmed via `git status --short` before and after this phase (see top of this
document for the "before" list) — every previously modified and untracked file listed
there is still present, unmodified by this phase, with no resets/discards/overwrites.
The only files this phase added to that list: `packages/shared/styles/tokens.css`
(now modified) and this document (new, under the already-untracked `docs/design/`).

---

## 9. Visual and functional checks performed

- `git diff --check` — clean (no whitespace errors).
- `npm run test:critical-smoke` — 5/5 pass (checkout authority, production hard
  stops, driver delivery/COD safety, public storefront filtering, refresh token
  rotation).
- `npm run build` — all five workspaces build clean: `@tuti/web`, `@tuti/seller`,
  `@tuti/admin`, `@tuti/driver`, `@tuti/sr`.
- Built customer CSS inspected directly: exactly one `:root` block (previously two);
  every token referenced by `storefront.css`/`client.css`/`homepage.css`/
  `immersive.css` that existed in the *old* local `:root` resolves correctly to the
  new canonical value (`--brand:#005c46`, `--ink:#171717`, `--paper:#fbf7ef`,
  `--gold:#d7a84a`, `--danger:#9f5139`, plus spot-checked structural tokens
  `--sp-4`, `--text-lg`, `--radius-md`, `--shadow-md`, `--z-sticky`, `--t-fast`,
  `--bp-md`, `--max-width` — all present and correct).
- Built admin and seller CSS inspected: `--brand:#005c46` present in both,
  identical to before the change (their own local overrides are untouched and still
  win) — mathematically zero visual change.
- Built driver and SR CSS inspected: now show `--brand:#005c46`, `--ink:#171717`,
  `--paper:#fbf7ef`, `--gold:#d7a84a`, `--danger:#9f5139` (previously the old
  `tokens.css` values) — the one intentional change, confirmed.
- Customer web visually verified in-browser (Playwright, dev server, all five app
  dev servers were already running): homepage hero + the "Start your journey"
  shortcuts launcher, and the Shop page header/toolbar/grid — both render pixel-for-
  pixel consistent with their pre-Phase-1 appearance (same dark-forest hero, same
  warm-cream surfaces, same gold/mint accents). 0px horizontal overflow on both.
- `:focus-visible` verified functionally, not just visually: tabbed through the
  customer header and confirmed via `document.activeElement.matches(':focus-visible')`
  → `true`.
- Seller, admin, driver, and SR login/landing screens were each loaded and
  screenshotted: all render without console errors, 0px horizontal overflow, and (for
  driver/SR) the brand color shift reads as a normal, coherent dark-green fill —
  no contrast or legibility issue introduced.
- Not done, and worth saying plainly: a full page-by-page visual regression pass of
  every screen in admin/seller/driver/SR was not performed. Given the change is
  value-only (admin/seller mathematically unaffected; driver/SR get a single
  consistent palette swap across every token simultaneously, not a selective change),
  a login-screen-level spot check was judged sufficient evidence for this phase. A
  fuller pass before any release would be reasonable.

---

## 10. Known remaining CSS debt (not touched this phase, by design)

- `admin-dashboard.css` and `seller.css` still carry their own redundant local
  `:root` blocks, now byte-identical to `tokens.css`. Harmless (no conflict, just
  dead weight), but not on the approved-files list for Phase 1 — candidate for a
  trivial Phase 2 deletion once someone outside this phase signs off on touching
  those two files.
- Eight CSS custom properties are referenced in `storefront.css` but have **never
  been defined anywhere** in this codebase, in either the old local `:root` or
  `tokens.css`: `--sand` (39 uses), `--page-x` (6), `--nile` (6), `--sp-7` (5),
  `--cream` (1), `--body` (1), `--shadow-lg` (1), `--sp-13` (1). **Confirmed
  pre-existing** — verified via `git diff` that none of these names were present in
  the `:root` block this phase removed, so this phase did not cause or worsen the
  issue. Deliberately not fixed here: defining them now would suddenly make
  currently-inert `clamp()`/`border`/`background` declarations start rendering real
  values in whichever sections use them (mostly the Legal/About/seller-onboarding
  areas of `storefront.css`), which is a visible layout/color change — exactly what
  this phase was told not to do. Recommend a small, dedicated, separate fix (not
  bundled into the token architecture work) where someone confirms what `--sand`/
  `--nile`/`--cream`/`--page-x`/`--body` were supposed to be before defining them.
- The `storefront.css` combo selector spanning `.nav-button, .filter-tab,
  .icon-button, .primary-action, .secondary-action, .ghost-action` (§6) still mixes
  six classes' worth of base styling in one rule, which is why the button-trio/
  icon-button consolidation couldn't be safely completed this phase.
- Phase 0's other findings (dead `CommerceHeader`/`HeroShowcase` cluster, legacy
  `catalog-*`/`category-*` naming, the `cl-*` dead subset, cross-file duplicate
  selectors like `.finder-layout`/`.sitemap-card`/`.featured-product-card`) are all
  still present — out of scope for this phase, which was tokens/atoms only.

---

## 11. Phase 2 recommendation

1. Untangle `storefront.css`'s six-class combo selector (§6) into one rule per
   class — purely mechanical, zero visual change if done carefully — as the
   prerequisite for finally being able to compare/merge the button-trio and
   icon-button radius/weight properties across web, admin, and seller without risking
   `.nav-button`/`.filter-tab` as collateral damage.
2. Decide, with design/product sign-off, whether the button-trio radius/weight
   divergence (web: radius-md + 800 weight; admin+seller: radius-md + 600 weight)
   should become one shared value or two named, intentional semantic tokens. Either
   answer is fine; what's not fine is leaving it as three silent, undocumented local
   overrides indefinitely.
3. Fix the eight undefined custom properties (§10) as its own small, reviewable
   change, once someone can say what `--sand`/`--nile`/`--cream`/`--page-x`/`--body`
   were meant to render.
4. Delete the now-fully-redundant local `:root` blocks in `admin-dashboard.css` and
   `seller.css` (confirmed byte-identical to `tokens.css`, zero risk) — small,
   separate, not bundled with riskier work.
5. Proceed to the header/homepage/shop/product-detail/purchase-flow/account
   migration order from `docs/design/css-revamp-audit.md` §10, now that the
   foundation phase is done.
6. Apply the deferred `var(--brand)`-instead-of-literal-rgba cleanup to `base.css`'s
   shared focus-visible rule (§6), with its own explicit focus-ring visual check.
