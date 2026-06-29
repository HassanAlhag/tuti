# CSS Revamp Phase 7 — Account, Orders, Wishlist, Support, and Reset Password Cleanup

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
 M apps/web/src/features/pages/sitemap/CartCheckoutPage.jsx
 M apps/web/src/features/pages/sitemap/OrderConfirmationPage.jsx
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
?? docs/design/css-revamp-phase-6.md
```

Exactly Phase 6's end state. `storefront.css`, `tokens.css`, and
`css-revamp-phase-1.md` remain staged from before Phase 1.

## The headline finding

The unauthenticated `/account` landing page — the very first thing a new or
logged-out visitor sees when they click "Account" — rendered as **completely
unstyled, stacked plain text**. `.account-grid` and `.account-card` (used by
the 4-card "Orders / Wishlist / Rewards / Saved addresses" preview) had
**zero CSS definitions anywhere in the codebase**, confirmed both by a
repo-wide grep and by reading the live computed style
(`display: block; border: 0; padding: 0`). This is fixed — see Task D/E.

## Task A — Live account/support/reset/auth architecture

- **Account**: `/account*` → `App.jsx` route `"account"` → `<AccountPage>`.
- **Reset password**: `/reset-password*` → route `"reset-password"` →
  `<ResetPasswordPage>`. Token read from the `?token=` query string; its
  presence determines the initial step (`request` vs `new-password`).
- **Support tickets**: `/support` or `/support?...` → route `"support"` →
  `<SupportTicketsPage>`.
- **Login/auth surfaces, all three confirmed live and distinct**:
  - `LoginPage` (`/login`) — a unified, role-aware sign-in page. Customers
    stay on the storefront after signing in; seller/admin/driver/sales_rep
    accounts are redirected to their own portal app.
  - `AuthModal` — a customer-only sign-in/register overlay, rendered by
    `ClientLayout.jsx` and opened via a `window.dispatchEvent(new
    CustomEvent("tuti:open-auth"))` custom event from anywhere in the app
    (the header's account chip, `SupportTicketsPage`'s sign-in prompt,
    `ResetPasswordPage`'s post-reset "Sign in" button, etc.).
  - The header's account dropdown (`ClientLayout.jsx`, out of this phase's
    scope) triggers the same event.
- **Orders**: loaded via `ordersApi.list({ page: 1, limit: 10 })` inside
  `AccountPage`'s own `useEffect`, independent of the Purchase Flow
  (Phase 6) and Order Confirmation pages, which each fetch independently
  too — no shared in-memory order cache, by design (each surface is
  resilient to a direct visit/refresh on its own).
- **Wishlist**: `useWishlistStore` (zustand, in-memory only — **not**
  wrapped in `persist`). True persistence is server-side: `toggle()` calls
  `authApi.toggleWishlist()`, and `App.jsx` re-hydrates the store from
  `user.wishlist` (the *cached, persisted* auth-store snapshot) on every
  fresh load. See Task B for a real bug found in this chain.
- **Addresses**: loaded from `user.addresses` (part of the persisted
  auth-store user object) and saved via `authApi.addAddress` /
  `updateAddress` / `deleteAddress`, each returning the full updated address
  array.
- **Support tickets**: created via `supportTicketsApi.create()`, listed via
  `supportTicketsApi.list()` with status/priority/category filters
  (react-query, `keepPreviousData`), replied to via
  `supportTicketsApi.reply()`. Already fully built and working before this
  phase — no functional changes needed here, see Task E.7.
- **Reset-password token flow**: `request` (email submitted, generic
  "if this email has an account…" response, optionally a `devToken` shortcut
  in non-production environments) → `new-password` (token + new password,
  with confirm-match and length validation) → `done` (success, "Sign in"
  re-opens `AuthModal`).
- **Refresh behaviour** (verified live):
  - **Account**: refreshing `/account` re-runs the orders fetch and
    re-derives wishlist/address state from the persisted `user` object —
    no data loss for anything already saved server-side.
  - **Support**: refreshing `/support` re-runs the tickets/orders queries
    (react-query); the ticket selected via `?ticket=` query param survives
    a refresh (re-read from the URL on mount).
  - **Reset password**: refreshing mid-flow returns to the `request` step
    unless a `?token=` is present in the URL (e.g., from an email link),
    in which case it correctly resumes at `new-password` — confirmed by
    reading `getTokenFromUrl()`'s use in the initial `step` state.

## Task B — Inline-style cleanup

28 inline `style={{...}}` objects found and migrated across the 4 files
Phase 0's audit flagged as the highest concentration in the app:
**AccountPage.jsx (14), ResetPasswordPage.jsx (10), AuthModal.jsx (3),
LoginPage.jsx (1)**. `SupportTicketsPage.jsx` had zero — already clean.

Every one was static (no per-instance dynamic values) and was migrated to
a scoped CSS class using canonical tokens — no dynamic CSS-variable styles
existed in this set, so none needed to stay inline. Two were found to be
fully redundant with existing CSS and were simply deleted rather than
replaced with a new class:
- `AuthModal.jsx`'s `style={{ marginTop: 0 }}` on a `.modal-hint` — that
  class already has `margin: 0` via shorthand.
- `LoginPage.jsx`'s `style={{ textAlign: "center" }}` on a `.ghost-action`
  button — the shared base rule already sets `justify-content: center` on
  an `inline-flex` container, making `text-align` a no-op for that content.

One inline style was a genuine **raw-colour smell**: `AccountPage.jsx` had
`style={{ color: "var(--danger, #b42318)" }}` — a token reference with a
hardcoded hex *fallback* that could never actually trigger, since
`--danger` is defined. Migrated to a class using `var(--danger)` directly,
dropping the dead fallback.

One was a **temporary-workaround-style block** with raw values throughout:
the order-dispute `<textarea>`'s `style={{ ..., borderRadius: "6px",
border: "1px solid #cdd5d0", fontSize: "0.875rem", ... }}` — migrated to
`.account-dispute-textarea` using `var(--radius)`, a token-mixed border
colour, and `var(--text-sm)`.

New classes added (all in storefront.css, scoped rather than broad
utilities per the brief): `.account-form-actions`,
`.account-settings-actions`, `.account-settings-saved`,
`.account-order-note-row`, `.account-order-feedback-error`,
`.account-dispute-textarea`, `.account-order-feedback-actions`,
`.reset-password-label`, `.reset-password-step`,
`.reset-password-actions`, `.reset-password-fit-action`,
`.reset-password-success`, `.reset-password-dev-token`,
`.modal-link-button`. Where two instances had genuinely identical
computed styles, they share one class (e.g., the two profile/address
save-and-cancel rows); where a value differed (the settings row's
`0.75rem` gap vs. the profile/address rows' `0.5rem`), a separate class
preserved the original value rather than silently rounding them together.

## Task C — Selector ownership map

| Area | Selectors (representative) | Location | Classification |
|---|---|---|---|
| Account shell | `.account-grid`, `.account-card`(+`.highlighted`) | storefront.css | **Account-owned — new this phase, had zero prior CSS** |
| Account tabs | `.account-tabs`, `.account-tab`(+`.active`) | storefront.css | Account-owned (pre-existing, touch-target fixed) |
| Profile/settings | `.account-form-section`, `.account-profile-display`, `.account-settings-list`(+`-row`/`-toggle`) | storefront.css | Account-owned |
| Addresses | `.account-address-list`(+`-row`/`-default-badge`/`-actions`) | storefront.css | Account-owned |
| Orders | `.account-orders-layout`(+`-panel`), `.account-order-row`, `.account-order-detail`, `.account-order-item-*`, `.account-order-note*`, `.account-order-resolution*` | storefront.css | Account-owned, several comma-grouped with `.order-summary-item`/`.order-confirmation-*` (Phase 6) — grouping noted, not changed |
| Wishlist | `.account-wishlist-grid`(+`-item`/`-media`/`-copy`/`-price`) | storefront.css | **Account-owned — new this phase** |
| Support tickets | `.support-page`, `.support-bridge*`, `.support-ticket-*` (compose/list/detail/thread/reply/pill/skeleton) | storefront.css | Support-owned, already comprehensive before this phase |
| Reset password | `.reset-password-*` (new) + reused `.order-confirmation-panel`/`.checkout-form-grid`/`.checkout-field-wide`/`.checkout-error`/`.checkout-auth-helper` (Phase 6) | storefront.css | Reset-password-owned for the new classes; intentionally shared for the rest |
| Auth modal | `.modal-overlay`, `.modal-card`, `.modal-head`, `.modal-tabs`(+`-tab`), `.modal-form`, `.modal-hint`, `.modal-link-button` (new) | storefront.css | Auth-owned |
| Shared utilities used here | `.empty-state`, `.metric-card`, `.page-title`, `.panel`, `.checkout-*` (form grid family) | storefront.css | Shared utility — untouched except the icon `aria-hidden` fixes below |

A repo-wide search confirmed no account/support/auth-exclusive selector
exists in `homepage.css` or `immersive.css`. `client.css` has exactly one
account/support-adjacent reference: `.seller-brand-products .empty-state`
— a descendant-selector scoped override for the Seller Brand page, not a
conflicting redefinition of the base `.empty-state` (verified by reading
full context; this is the same false-positive pattern Phases 3–6 each
warned about and is correctly *not* a duplicate).

### Genuine duplicate found and merged

`.account-order-row` appeared twice as a standalone rule start, but reading
both in full showed they set entirely different, non-overlapping
properties (one gives it the shared grid/shell visuals it gets via a
compound with `.order-summary-item`; the other gives it button-specific
behaviour — width, cursor, hover/active states). This is the same
"correctly split across non-conflicting locations" pattern already
documented for `.checkout-layout` in Phase 6 — verified, not touched.
`.modal-form`'s 9 occurrences are all genuine descendant-selector
variations (`label`, `input`, `input:focus`, `textarea`/`select`
compound, etc.) targeting different child elements — also verified clean,
not touched.

## Task D — CSS consolidation performed

**Added (was entirely missing — not a consolidation, new coverage):**
`.account-grid`/`.account-card`(+`.highlighted`) and the full
`.account-wishlist-*` family, both detailed in Task E below.

**Section labels added** matching the brief's preferred organization:
`Account shell`, `Wishlist`, `Profile and settings`, `Addresses`,
`Orders`, `Support tickets`, `Reset password` (new section, placed
directly before the pre-existing `Auth modal` label). `Account tabs` and
`Auth modal` already had labels from earlier work this design cycle.
A top-level `ACCOUNT` ownership banner (matching the `PURCHASE FLOW`/
`SHOP` banners from Phases 4–6) was added above the tabs section,
explicitly noting which order-related selectors are intentionally shared
with Phase 6's territory rather than re-documenting that sharing twice.

**No selectors were deleted.** Task C's investigation found the existing
account/support CSS to be either correctly single-owned or correctly,
non-conflicting split — there was no dead weight to remove in this area,
unlike Phases 2/5/6's findings elsewhere.

## Task E — Visual and UX enhancement

**1. Account overview — critical fix.** The signed-out landing view (4
cards: Orders/Wishlist/Rewards/Saved addresses) had zero CSS. Added
`.account-grid` (4-column grid, collapsing to 2 at ≤1180px and 1 at
≤520px — canonical breakpoints, no new one-offs) and `.account-card`
(gradient background, border, radius, shadow — matching the visual
language already established for `.checkout-form-card`/
`.order-confirmation-panel` elsewhere in this file, satisfying "visually
connected to... Checkout"). `.highlighted` gets a subtly distinct border
tint, not a loud treatment — consistent with "calm... premium," not
"dashboard-heavy."

**2. Account navigation** — already correct before this phase
(keyboard-operable buttons, `aria-current="page"`, horizontal
`overflow-x: auto` with hidden scrollbar for mobile). Fixed one gap: the
tab buttons' touch target was 35px (`min-height: 2.2rem`), below the 44px
minimum — raised to `2.75rem`. Verified live at 375px: all 5 tab labels
present, row correctly scrolls (confirmed `scrollWidth` 523px vs.
`clientWidth` 343px), no clipping.

**3. Profile and settings** — already fully built (display/edit modes,
save/cancel, validation error display, settings toggles with a save
confirmation). No behavioural changes; only the inline styles were
migrated (Task B). Verified live: editing and saving a profile name
persists and displays correctly.

**4. Address book** — already fully built (full CRUD: add, edit, delete,
set-default, with a default badge). No behavioural changes; verified live
end-to-end: add → shows in list → set default → badge appears → remove →
list empties correctly, 0 console errors throughout.

**5. Orders** — already comprehensive (list + detail with timeline,
items, delivery/payment summary, gift message, dispute resolution
display, and a full accept/dispute/report feedback flow for delivered
orders). No behavioural changes; verified live: 7 order rows render
correctly with a detailed, well-organized order panel — does not read as
a "dashboard," reads as a customer order history.

**6. Wishlist — real gap found and fixed.** Previously rendered each
wishlisted item as a bare `<strong>{productId}</strong>` — the literal
internal product ID as visible text, with a generic "Saved product"
label and only a "View" action; no image, name, seller, or price; no
remove action despite `useWishlistStore` already exposing `toggle` for
exactly that purpose. Rewired `AccountPage` to receive `products` and
`getShop` as new props from `App.jsx` (a small, additive change —
`shared.products`/`shared.getShop` already existed there for other pages;
this just extends the same established pattern to `<AccountPage>` rather
than having it fetch independently and redundantly). Each wishlist item
now renders a real card: product image (`BottleArt` fallback when none),
product name, seller name (via `getShop`), price, a "View" action, and an
explicit, labelled remove button. A wishlisted product ID no longer
present in the live catalogue is silently excluded (correct — nothing to
show for an archived/removed product), via a plain `.filter()`, not a
fabricated "unavailable" placeholder.

**Real persistence bug found and fixed in the same area**: `useWishlistStore`
is in-memory only; the *actual* cross-session persistence path is
`App.jsx` re-hydrating it from `user.wishlist` (the cached, `localStorage`-
persisted auth-store snapshot) on every fresh load. `toggle()` updated its
own in-memory `ids` and the *server* correctly, but never refreshed the
cached `user.wishlist` snapshot in the auth store — so a toggle would
appear to silently revert after a full page reload. Fixed with a 2-line
addition to `wishlistStore.js`'s `toggle()`: after a successful server
round-trip, also call `useAuthStore.getState().updateUser({ wishlist:
result.wishlist })` to keep the persisted snapshot in sync. Verified live
end-to-end: toggled a product's wishlist state, confirmed the
`localStorage` `tuti-auth` snapshot updated immediately, then confirmed
the heart icon still showed "saved" after a real, full
`page.reload()` — it did not before this fix.

**7. Support tickets** — already fully built and working (create, filter
by status/priority/category, search, reply, order-linking, a sign-in gate
for unauthenticated visitors). Verified live: created a real ticket
end-to-end, it appeared in the list immediately. No internal-only fields
are exposed anywhere (read every render branch to confirm). The 4 metric
cards (Tickets/Open/Waiting/Resolved) read as a real, useful summary of
the customer's *own* ticket history, not a vanity admin metric — judged
acceptable against the "must not feel like an admin dashboard" goal and
left as-is rather than redesigned without a concrete problem to fix.

**8. Reset password** — already complete (clear heading, step-aware
explanatory text per stage, labelled fields, the existing 8-character
minimum communicated via placeholder, distinct success/error states,
return-to-sign-in action). No behavioural changes; only inline styles
migrated (Task B). Verified live: the `request` → `sent` step transition
renders the correct, security-conscious generic message ("If
customer@tuti.dev has a Tuti account...") regardless of whether the email
matches a real account — confirmed this doesn't leak account existence.

## Task F — Auth modal and login polish

Scope kept narrow, as instructed — no redesign attempted.
- Removed all 3 inline styles (Task B): the redundant `marginTop: 0`, and
  two identical inline-styled "text link" buttons that fully overrode
  `.ghost-action.compact` down to a plain underlined link — replaced with
  one new `.modal-link-button` class (and `.ghost-action.compact` is no
  longer applied to these, since the inline override made it irrelevant
  anyway).
- Modal focus behaviour, the accessible `aria-label="Close"` button, and
  the click-outside-to-close handler were all already correct and
  untouched.
- Verified live: modal opens (via the header's "Hello, sign in" trigger),
  closes via the X button, and the "Forgot your password?" link correctly
  closes the modal and navigates to `/reset-password`.
- No social/provider login exists in this app to verify or break.

## Task G — States and validation

**Loading**: not redesigned, per the brief. Same documented architectural
limitation as Phases 4–6: `App.jsx` gates the entire router on one global
`loading` flag before any route — including Account/Support/Reset-
password — mounts. `SupportTicketsPage` additionally has its own,
independent react-query loading states for tickets/orders (a skeleton
placeholder, `.support-ticket-skeleton`) — already built, unrelated to and
unaffected by the global gate.

**Empty states**: all deliberate and already present —
`.account-empty-state` (addresses, wishlist before this phase's fix,
orders, no-order-selected) and `EmptyState` (support tickets, ticket
detail, ticket reply thread) all show a clear heading/icon/explanation and
a relevant action where applicable. No technical language found anywhere
in these states.

**Error states**: customer-friendly throughout — order list/detail load
errors, profile/address save errors, support ticket creation/reply errors,
and reset-password request/confirm errors all show plain-language
messages with no stack traces (verified by reading every catch branch).

**Validation**: native HTML5 field requirements plus explicit
application-level checks (password match, 8-character minimum, required
subject/category/description for support tickets) were all already
correct and unchanged. Form data is preserved on a recoverable error in
every case checked — e.g., a failed profile save keeps the edit form open
with the user's typed values intact, since the error path only sets
`profileError`, never resets `profileForm`.

## Task H — Accessibility

Verified live (Playwright) and by direct code reading:
- Exactly one `<h1>` on Account (confirmed both signed-out and signed-in).
- Zero duplicate `id` attributes.
- Zero `<svg>` elements without `aria-hidden="true"` inside `<main>` —
  swept all 5 primary files plus `EmptyState.jsx`/`MetricCard.jsx` (shared
  with ~30+ Seller/Admin/Driver/SR consumers each, same zero-visual-impact
  category of fix already established in Phase 5 for `PanelHeader.jsx`).
- Tabs expose `aria-current="page"`; support ticket rows and payment/
  identity choices elsewhere in the app already use `aria-pressed`/
  `aria-checked` correctly (unchanged, verified).
- All forms have visible or programmatic labels (every `<label>` wraps its
  input — implicit association, valid).
- Order status is shown via `StatusBadge` (text content), never colour
  alone.
- The auth modal has an accessible close button (`aria-label="Close"`)
  and the support-reply textarea, ticket-create form, and address/profile
  forms all have associated labels.
- `:focus-visible` confirmed functional on the Account page.
- **Touch targets**: fixed `.account-tab` (35px → 44px, this phase's own
  new/touched code). Found, but correctly did **not** touch, the
  pre-existing `.compact` modifier (`min-height: 2.15rem` ≈ 34px) — this
  is the same already-documented (Phase 1) shared-button-sizing
  divergence affecting `.icon-button`/`.primary-action`/`.secondary-
  action`/`.ghost-action` app-wide; `.compact` is simply the same issue
  surfacing on a different shared modifier, used by hundreds of buttons
  across every page in every app, and changing it is explicitly out of
  this phase's (and every prior phase's) authorized scope.
- No keyboard trap: the auth modal is the only modal-like surface in this
  scope, and it closes correctly via its close button, click-outside, and
  (pre-existing, unchanged) was not found to trap focus.

## Task I — Responsive results

Verified live and via screenshots at all four required widths on
`/account` (authenticated, Orders tab):

| Width | Overflow | Notes |
|---|---|---|
| 375px | 0px | Tabs scroll horizontally, cleanly, no clipping; order list/detail stack to one column |
| 768px | 0px | — |
| 1280px | 0px | — |
| 1440px | 0px | — |

At desktop, `.account-orders-layout`'s two-column split (list + detail)
remains balanced via the existing `minmax(0, 1.2fr) minmax(20rem,
0.8fr)` template (unchanged); no empty side column appears since the
detail panel always renders something (either a selected order or the
"No order selected" empty state). The new `.account-grid`/`.account-card`
and `.account-wishlist-grid` both collapse correctly at the canonical
1180px/520px breakpoints and via `auto-fill` respectively (Task J).

## Task J — CSS quality

- Canonical tokens used throughout every new/touched rule.
- No new one-off breakpoints introduced. `.account-grid` uses the
  canonical 1180px/520px breakpoints (added to existing shared blocks,
  not new ones). `.account-wishlist-grid` deliberately uses `repeat(
  auto-fill, minmax(14rem, 1fr))` instead of explicit breakpoints — this
  collapses to 1 column below ~28rem of available width without needing
  a dedicated media query at all, which is simpler and more robust than
  picking an arbitrary pixel cutoff for a card grid whose item count
  varies per customer.
- No `!important` added.
- No raw colours introduced where a token exists — the one pre-existing
  instance found (`var(--danger, #b42318)`) was corrected to drop its
  dead hex fallback during the inline-style migration (Task B).
- Logical properties: none of the new rules had a meaningful directional
  property to convert (grids, colors, flex layout, sizes — none
  directionally sensitive here).
- Did not alter unrelated page rules — the one shared selector touched
  for content reasons (`.account-order-row`) was read in full first and
  confirmed non-conflicting before deciding not to merge it further.

## Lines and bundle size

| Metric | Before Phase 7 | After Phase 7 | Change |
|---|---|---|---|
| `storefront.css` lines | 10,355 | 10,569 | +214 (account-grid/card, wishlist grid, reset-password classes, modal-link-button, section labels — new functional CSS, not consolidation) |
| `AccountPage.jsx` lines | 695 | 721 | +26 (wishlist rewrite, new props, style migrations) |
| `ResetPasswordPage.jsx` lines | 175 | 174 | −1 |
| `AuthModal.jsx` lines | 173 | 171 | −2 |
| `LoginPage.jsx` lines | 161 | 160 | −1 |
| `SupportTicketsPage.jsx` lines | 636 | 636 | 0 (aria-hidden added inline, no line change) |
| `App.jsx` | — | — | +1 line (`products`/`getShop` props added to `<AccountPage>`) |
| `wishlistStore.js` | 27 | 30 | +3 (auth-store sync fix) |
| Customer web CSS bundle (raw) | 235.30 kB | 237.92 kB | +2.62 kB — expected: this phase added real missing CSS, it did not consolidate existing CSS |
| Customer web CSS bundle (gzip) | 40.97 kB | 41.37 kB | +0.40 kB |
| Seller / Admin / Driver / SR CSS bundles | unchanged | unchanged | 0 bytes |
| Seller / Admin / Driver / SR JS bundles | — | — | Changed by a few bytes — `EmptyState.jsx`/`MetricCard.jsx` are shared with ~30+ files in each of those apps; the only change is an additive `aria-hidden` attribute, same zero-visual-impact category Phase 5 already established for `PanelHeader.jsx` |

## Verification

- `git diff --check` — clean.
- One CSS build break was introduced and caught during this phase, the
  *exact same mistake* as Phase 6: a new ownership-banner comment's own
  prose contained the literal substring `-*/.order-confirmation-*`,
  closing the comment early. Caught immediately by the build failing
  (lightningcss: "Unexpected token Delim('*')"), fixed by rewording to
  avoid the wildcard-asterisk-next-to-slash pattern, confirmed via a
  comment-balance check before continuing. Recorded plainly since it's
  now a repeat of a known failure mode — worth calling out rather than
  quietly fixing and moving on.
- `npm run test:critical-smoke` — 5/5 pass, including "refresh token
  rotation" specifically (relevant given this phase touched auth-store-
  adjacent code in the wishlist fix).
- `npm run build` — all five workspaces build clean.
- Functional, live-browser checks: auth modal opens/closes and its
  forgot-password link navigates correctly; account route opens both
  signed-out (now correctly styled) and signed-in; all 5 tabs switch
  correctly; profile edit saves and displays the update; full address
  CRUD (add → set default → remove) works end-to-end; wishlist add/remove
  works and **survives a real page reload** (the bug fix, confirmed
  directly, not just via the optimistic UI); orders tab renders 7 real
  order rows with full detail; a real support ticket was created and
  appeared in the list immediately; reset-password's request step
  produces the correct security-conscious response; Home, Shop, Product
  Detail, and Cart (including a fresh add-to-cart from Product Detail)
  all confirmed unaffected with 0 console errors and 0px overflow.
- Visual checks captured and reviewed at 375/768/1280/1440px for the
  account overview (signed-out grid, now fixed), tabs, addresses,
  orders, wishlist, support, reset-password, and the auth modal.
- Accessibility checks: one `<h1>`, zero duplicate IDs, zero unmarked
  decorative icons across every file touched, `:focus-visible`
  functional, account-tab touch targets corrected to 44px.

## Pre-existing work preserved

All pre-flight items are present and unchanged after this phase. Phase 7's
own changes: `AccountPage.jsx`, `ResetPasswordPage.jsx`, `AuthModal.jsx`,
`LoginPage.jsx`, `App.jsx`, and `storefront.css` modified;
`packages/shared/store/wishlistStore.js` and
`packages/shared/components/EmptyState.jsx`/`MetricCard.jsx` (shared,
outside `apps/web`) modified; this document added.

## Remaining debt

- The `.compact` modifier's 34px touch target (and the underlying
  `.icon-button`/`.primary-action`/`.secondary-action`/`.ghost-action`
  40px base, documented since Phase 1) remains unfixed — shared across
  every page in every app; fixing it is a dedicated, app-wide phase of
  its own, not a Phase 7 (or any prior phase's) task.
- Loading/error states remain app-wide — same architectural gap already
  documented for Shop, Product Detail, and Cart/Checkout.
- Support's 4 metric cards are a judgment call left as-is (see Task E.7)
  rather than a fix — flagged for awareness, not a defect.
- `GiftBoxCard.jsx`'s borrowed `cake-*` class names (Phase 4 debt) and the
  `.sitemap-hero-actions` cross-file duplicate (Phase 6 debt) remain
  unchanged — neither is account/support/auth-exclusive.

## Recommendation for Phase 8

1. If a dedicated "fix shared touch targets app-wide" phase is ever
   scoped, `.compact`, `.icon-button`, `.primary-action`,
   `.secondary-action`, and `.ghost-action` should all move together —
   they're the same underlying issue, found independently in Phases 1,
   6, and 7.
2. Apply this phase's live-verification rigor (not just static reading)
   to the Seller/Admin/Driver/SR apps' own account-equivalent screens next
   if any further CSS-revamp phases extend beyond the customer app — this
   phase confirmed `EmptyState`/`MetricCard`/`PanelHeader` are heavily
   shared with those apps but did not audit those apps' own pages.
3. Low-priority: revisit whether Support's metric-card row should be
   visually softened further if a future design pass specifically
   targets the "admin dashboard" feeling — no concrete change is
   recommended now absent a specific problem.
