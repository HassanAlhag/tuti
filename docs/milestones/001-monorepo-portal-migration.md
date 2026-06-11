# Milestone 001: Portal Monorepo Migration

## Status

Phase 1 & 2 Complete ✓  
Phase 2.5 Complete ✓ — Customer Web UI Stabilization

The monorepo migration foundation is complete. All three portal apps build and run independently. No bridge aliases remain in any app.

The legacy frontend folder has been removed after customer web UI stabilization. Root `npm run build` passes for `@tuti/web`, `@tuti/seller`, and `@tuti/admin`.

---

## Goal

Move Tuti from one growing frontend into a scalable marketplace monorepo with separate customer, seller, admin, and API applications.

Tuti is a multi-sided marketplace:

- Web — customers browse perfumes, cakes, sweets, gift boxes, bundles, reviews, cart, checkout, and guest/customer accounts.
- Seller — sellers manage their shop, products, delivery, orders, customers, analytics, payouts, and payment readiness.
- Admin — admin manages users, roles, sellers, products, payments, payouts, support tickets, audit log, and marketplace quality.
- API — Express API owns MongoDB, authentication, permissions, marketplace data, payments, ratings, notifications, and seed scripts.

---

## Monorepo Structure — Current

```txt
tuti/
  apps/
    web/       @tuti/web     :5173  customer storefront
    seller/    @tuti/seller  :5174  seller portal
    admin/     @tuti/admin   :5175  admin console

  packages/
    shared/    @tuti/shared        api client, auth store, constants, components, utils, styles

  backend/                  :5055  Express API
  docs/
    milestones/
      001-monorepo-portal-migration.md
```

---

## Target Structure — Future Phases

txt tuti/ apps/ web/ seller/ admin/ api/ Move backend/ here in Phase 4 packages/ ui/ Shared UI primitives shared/ api, store, providers, utils constants/ roles, permissions, categories config/ shared build/lint config services/ payments/ Gateway, COD, reserves, payouts notifications/ Email, WhatsApp, SMS storage/ Image uploads search/ Product/shop search docs/ architecture.md payment-flow.md seller-flow.md roles-permissions.md

---

## Migration Principles

- Keep every app building at every step.
- Move one portal at a time.
- No bridge aliases in production code.
- Shared code lives in packages/ only when two or more apps need it.
- Split backend by business capability, not by database table.
- Avoid premature abstraction. Do not move unfinished UI into packages/ui.
- Stabilize customer, seller, and admin experiences before large package extraction.
- One task, one area, small change, test, commit.

---

## Dev & Build Commands

bash # Root npm run dev # backend + web + seller in parallel npm run dev:backend # API only :5055 npm run dev:web # customer app :5173 npm run dev:seller # seller portal :5174 npm run dev:admin # admin console :5175 npm run build # all three apps npm run build:web npm run build:seller npm run build:admin

---

# Phase 1 — Portal Separation ✓

Created standalone Vite apps for each portal. Root workspace scripts target apps by package name.

- apps/web → @tuti/web
- apps/seller → @tuti/seller
- apps/admin → @tuti/admin
- packages/shared → @tuti/shared

Each app resolves @tuti/shared via Vite alias to ../../packages/shared.

---

# Phase 2 — Remove Frontend Bridges ✓

All feature code extracted from the legacy frontend into the owning portal. No bridge aliases remain.

## apps/web

- features/layout/ — ClientLayout, ClientFooter
- features/auth/ — AuthModal
- features/notifications/ — re-exports @tuti/shared/components/NotificationBell.jsx
- features/pages/ — HomePage, ShopPage, ProductPage, CartPage, CollectionsPage, ShopsPage, AboutPage, SellerLandingPage, SitemapPages
- features/reviews/ — ReviewContributionPanel
- features/storefront/ — StorefrontPage + storefront components
- store/cartStore.js — web-only cart store
- styles/client.css
- Image assets under src/assets/

## apps/seller

- features/layout/SellerLayout.jsx
- features/auth/SellerLogin.jsx
- features/notifications/NotificationBell.jsx
- features/dashboard/SellerPortal.jsx
- features/dashboard/components/SellerDashboardPrimitives.jsx
- features/dashboard/index.js
- styles/seller.css

## apps/admin

- features/admin/AdminConsole.jsx
- features/admin/AdminUsers.jsx
- styles/admin-dashboard.css
- styles/admin.css

## packages/shared

- api/client.js
- brand.js
- store/authStore.js
- utils/money.js
- utils/rating.js
- providers/QueryProvider.jsx
- components/NotificationBell.jsx
- components/BottleArt.jsx
- components/EmptyState.jsx
- components/MetricCard.jsx
- components/PageTitle.jsx
- components/PanelHeader.jsx
- components/StarPicker.jsx
- components/StatusBadge.jsx
- styles/tokens.css
- styles/base.css

---

# Phase 2.5 — Customer Web UI Stabilization — Complete

## Why this phase exists

After the monorepo migration, the customer web app had working routes and separated structure, but several newly wired pages needed stabilization. This phase brought the customer storefront to a consistent, responsive baseline.

This phase stabilizes the visible customer storefront before extracting shared UI packages or adding large marketplace features.

## Goal

Make the customer storefront visually consistent, responsive, and usable before Phase 3 package extraction.

## Completed focus

- Header/top menu layout
- Footer layout
- Inner page styling
- Gifting page
- Fragrance Finder page
- Offers page
- Journal page
- Shop filters/search behavior
- Product detail UI by product type
- Cart and checkout visual consistency

## Completed in Phase 2.5

### Routing and navigation

- Wired previously unreachable pages:
  - /fragrance-finder
  - /gifting
  - /offers
  - /journal
  - /contact
  - /customer-service
  - /account
  - /store-locator
  - /legal

### Header and footer

- Added CSS for missing header classes used by ClientLayout.jsx.
- Stabilized the two-row header layout.
- Aligned category rail with top header content.
- Improved account/cart spacing.
- Converted footer into responsive 4-column sitemap layout.
- Footer responsive behavior:
  - Desktop: 4 columns
  - Tablet: 2 columns
  - Mobile: 1 column

### Marketplace logic fixes

- Occasion chips now navigate with an occasion filter.
- Search includes cake flavors[] and occasionTags[].
- Women/Men/Unisex category links now filter perfume products properly.
- Gift products use category === "gift_box" or category === "bundle".
- ProductCard safely handles missing notes.
- Fragrance Finder CTA carries selected scent family into the shop filter.
- Cart quantity behavior documented as absolute value, not delta.

## Remaining Phase 2.5 tasks

None. Phase 2.5 is complete and root `npm run build` passes.

Historical checklist retained below for context.

### Inner page UI

Style the following pages so they look like premium marketplace pages, not raw document pages:

- /gifting
- /fragrance-finder
- /offers
- /journal

Required improvements:

- Reduce oversized page H1s.
- Reduce huge white space.
- Convert raw lists into cards/grids.
- Replace default browser fieldsets in Fragrance Finder with styled filter cards.
- Add responsive layout and proper visual hierarchy.
- Preserve dark green/gold brand style.
- Do not change routing or backend.

### Customer storefront polish

After inner pages are styled:

- Review Home page visual hierarchy.
- Review Shop page filters and product grid.
- Review Product Detail page for perfumes, cakes, sweets, and gift boxes.
- Review Cart and Checkout.
- Test mobile responsiveness.
- Run full build.

## Definition of done for Phase 2.5

Phase 2.5 is complete when:

- Customer can navigate all main web routes without broken or raw UI.
- Header and footer are stable on desktop, tablet, and mobile.
- Gifting, Fragrance Finder, Offers, and Journal pages are styled.
- Shop search/filter flows work for perfume and cake products.
- Product cards do not crash when optional fields are missing.
- npm run build passes.
- Changes are committed.

---

# Phase 3 — Shared Packages

Do not start Phase 3 until Phase 2.5 is complete.

## Goal

Extract only stable and truly shared code into dedicated packages.

## Planned packages

| Package            | Contents                                                               |
| ------------------ | ---------------------------------------------------------------------- |
| packages/ui        | Shared UI primitives used by two or more apps                          |
| packages/constants | Roles, permissions, product categories, scent families, order statuses |
| packages/config    | Vite base config, ESLint config, Tailwind preset if adopted            |

## Important rule

Only move a component to packages/ui when at least two apps use it.

Good candidates:

- Button
- Card
- Badge
- EmptyState
- StatusBadge
- MetricCard
- PageTitle
- PanelHeader
- StarPicker
- Modal
- Input
- Select
- Table

Be careful moving storefront-specific components too early:

- ProductCard
- BottleArt
- CakeCard
- GiftBoxCard
- Storefront-only cards

These should stay in apps/web unless seller/admin also need them.

---

# Phase 4 — Backend Domain Split

Do not start until customer, seller, and admin apps are stable.

Move:

txt backend/ → apps/api/

Then split modules by business capability:

txt apps/api/src/modules/ auth/ users/ sellers/ products/ orders/ payments/ payouts/ reviews/ notifications/ uploads/ admin/

---

# Phase 5 — Marketplace Scale

Future capabilities:

- Payment provider adapter layer
- COD and gateway flows
- Seller reserve rules
- Payout ledger
- Seller verification workflow
- Audit event stream
- Full-text search indexing
- Image CDN and presigned uploads
- Notification queue
- Analytics pipeline

---

# Current Recommendation

The project is going in the right direction.

The immediate priority is not more architecture work. The immediate priority is:

txt Finish Phase 2.5 — Customer Web UI Stabilization

After that:

txt Build → Test → Commit → Then start Phase 3
