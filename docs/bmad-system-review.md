# BMAD System Review: Perfume Marketplace / Tuti

Review date: 2026-06-12  
Review mode: read-only repository inspection, plus this requested review document. No tests were run and no refactors were performed.  
BMAD/WDS lenses applied: BMAD Analyst, BMAD Architect, BMAD Test Architect, and Whiteport Design Studio.

## Executive summary

Tuti is a monorepo for a UAE-focused premium gifting marketplace that combines perfumes, cakes, desserts, curated gift boxes, seller operations, admin operations, driver delivery, and sales representative workflows. The customer storefront is visually ambitious and already has a strong gifting direction, especially the Build Your Box experience. The backend is more substantial than a prototype: it has JWT auth, product approval workflow, order state transitions, stock deduction, support/disputes, seller balances, payouts, COD settlement, driver delivery, notifications, audit logging, reports, and optional Mongo persistence.

The system is not production ready yet. The largest blockers are not cosmetic. The checkout API trusts client-supplied product names, shop IDs, prices, and item details; card payment states exist without a real gateway; seed/demo auth can create privileged users if seed mode is accidentally deployed; driver delivery has a likely runtime exception after mutation; and public storefront data can expose all Mongo products rather than only live approved catalog items.

The recommended next move is not a broad refactor. Lock the purchase, delivery, and production-safety invariants first, then use BMAD/WDS to formalize the MVP scope, architecture decisions, risk-based tests, and UX specs for the customer purchase loop.

## 1. What this system currently is

Tuti is currently a full-stack marketplace product with five Vite React frontends, one Express API, a shared frontend package, and optional MongoDB persistence. The root workspace uses npm workspaces for `backend`, `apps/*`, and `packages/*`.

Current product shape:

- Customer web storefront: discovery, category shopping, product detail, Build Your Box, cart, checkout, order confirmation, account, support, seller brand pages, editorial/static pages.
- Seller portal: onboarding, brand profile, products, orders, drivers, customers, analytics, payouts, support.
- Admin console: operations, sellers, products, orders, users, drivers, sales reps, payouts, audit, support, merchandising.
- Driver portal: assigned deliveries, offers, pickup/delivery completion, COD handling.
- Sales rep portal: referral and seller acquisition workflows.
- Backend API: marketplace, auth, orders, drivers, support, notifications, users, sales reps, audit, reports, merchandising, seller applications, CRM.

The README and status docs describe the project as a standalone luxury gifting marketplace. Source inspection agrees with that direction. It is beyond a pure mockup, but some subsystems still mix durable logic with seed/demo behavior.

## 2. Frontend structure

The frontend is a multi-app Vite structure:

- `apps/web`: customer storefront.
- `apps/seller`: seller dashboard.
- `apps/admin`: admin console.
- `apps/driver`: driver portal.
- `apps/sr`: sales representative portal.
- `packages/shared`: shared API client, auth store, components, constants, hooks, styles, utilities, and workflow helpers.

Customer web structure:

- `apps/web/src/App.jsx` owns custom routing using `window.location`, `history.pushState`, and `popstate` rather than React Router.
- It fetches `/api/marketplace/storefront` once and performs much of the customer filtering/search locally.
- Route surfaces include home, shop, products, cart, order confirmation, collections, seller brand pages, Build Your Box, account, support, seller landing, and static sitemap pages.
- `apps/web/src/store/cartStore.js` persists the cart in localStorage through Zustand under `tuti-cart`.
- `packages/shared/store/authStore.js` persists auth tokens in localStorage under `tuti-auth`.

Customer checkout structure:

- `CartCheckoutPage` defaults to COD, keeps card as a selectable concept in state/copy, and posts to `ordersApi.create`.
- The cart is transformed into order payloads by `compactOrderItem`, which sends product ID, product name, shop ID, price, quantity, and optional metadata/configuration.
- Guest order tokens are stored in `sessionStorage` for the `/orders/:orderId` confirmation route.

Strengths:

- The customer app has a coherent premium gifting direction.
- Build Your Box is a real guided flow, not just a button.
- Shared package centralizes API access, auth state, money formatting, reusable components, and status/workflow constants.
- Seller/admin/driver/SR are separated into distinct apps, which is good for role-specific deployment and UI focus.

Frontend risks:

- The customer app depends heavily on large storefront payloads and client-side filtering. This will not scale well for a larger catalog.
- Tokens in localStorage create XSS blast radius.
- The auth refresh client updates only the access token, while the backend rotates refresh tokens. This can cause session failure after the first refresh in Mongo mode.
- Guest confirmation depends on sessionStorage. A user opening the order link in a fresh browser session will not have the token unless email links include it.
- App routing is custom and works for current scope, but future nested states, redirects, analytics, and guarded routes will become more brittle.

## 3. Backend/API structure

The backend is an Express application in `backend/src`.

Core API setup:

- `backend/src/app.js` applies pino HTTP logging, Helmet, mongo sanitization, HPP protection, CORS, JSON size limits, global rate limiting, and an auth-specific limiter.
- Uploads are seller/admin-only at `/api/upload`.
- Upload storage uses S3/R2 when env vars are present, otherwise local disk under `/uploads`.
- Health endpoint reports whether Mongo is configured or seed memory is being used.

Mounted API modules:

- `/api/auth`
- `/api/crm`
- `/api/driver`
- `/api/drivers`
- `/api/support`
- `/api/admin/support`
- `/api/public`
- `/api/events`
- `/api/admin/merchandising`
- `/api/seller`
- `/api/marketplace`
- `/api/seller-applications`
- `/api/orders`
- `/api/notifications`
- `/api/users`
- `/api/sr`
- `/api/admin/audit`
- `/api/admin/reports`

Backend strengths:

- The service layer is organized by modules.
- Zod validation exists for many user-facing payloads.
- There is an explicit product workflow and order workflow.
- Support/dispute flows are more mature than expected for this project stage.
- Finance has ledger-like SellerTransaction records for seller balance events.
- Admin audit and reporting modules exist.

Backend risks:

- Some critical service behavior still trusts client data.
- Some admin APIs still use seed repository logic in Mongo mode.
- Several operations mutate multiple collections without Mongo transactions.
- Production environment validation does not require `MONGO_URI`, so seed memory can still be used if misconfigured.
- Production CORS validation can pass through localhost defaults because `parseOrigins()` returns defaults when no origins are configured.

## 4. Database/data model understanding

The backend can run in two modes:

- Mongo mode: enabled when `MONGO_URI` is set.
- Seed-memory mode: used when `MONGO_URI` is empty, with in-memory data and demo behavior.

Main Mongo models:

- `User`: authentication, roles, shop linkage, driver linkage, permissions, profile fields, addresses, wishlist, settings, password reset, refresh token.
- `Shop`: seller identity, status, owner, category/categories, payment/commission/hold fields, delivery model, onboarding, contract state, sales rep attribution.
- `Product`: catalog item with category, price, stock, status, perfume/cake/gift fields, ratings, approval/edit metadata.
- `Order`: customer/order snapshot, items, payment method/status, delivery fields, shop IDs, status history, customer response, support case, resolution decision, driver assignment, idempotency key, guest confirmation token hash.
- `Driver` and `DeliveryOffer`: seller/platform delivery operations and offer acceptance.
- `SupportTicket`: customer/seller/driver/admin support cases and conversion into disputes.
- `SellerTransaction` and `Payout`: seller balance ledger and payout state.
- `CommissionEntry`, `SalesRep`, `SellerReferral`, `Lead`, `SRTarget`: sales representative and referral commission flows.
- `Notification`: role and recipient notifications.
- `AuditEvent`: admin/security/audit events.
- `Review`, `SellerBrandProfile`, `CuratedCollection`, `FeaturedProductPlacement`, `FeaturedSellerPlacement`, `MarketplaceEvent`: marketplace merchandising and content.

Important model observations:

- `Order.items` stores a snapshot of product details and prices, but those details are currently accepted from the checkout payload for normal items.
- `Order.driverAssignment` includes driver, delivery, and COD settlement fields, but it does not define `proofOfDeliveryUrl` or `pickedUpAt` even though driver services attempt to write those fields.
- `Customer` model exists, but admin customer views are largely derived from seed customers and order summaries rather than a fully durable customer CRM model.
- Product and order status fields are enum-like strings. The workflow helpers are important and should remain the source of truth.

## 5. Flow review

### Product and category flow

Current state:

- Sellers/admins can create products across perfume, cake, dessert, gift box, and bundle categories.
- Seller sensitive edits move products back to `Needs approval`; stock-only updates preserve current status.
- Admins can update product status.
- Search endpoint filters live products and supports category, scent family, gender, occasion, price, stock, paging, and limits.
- Public storefront endpoint in Mongo mode currently loads all products and shops.

Risks and gaps:

- `getStorefrontData()` uses `Product.find({})` and `Shop.find({})`, so it can expose draft, rejected, or pending products in public storefront data. The frontend filters some views, but public API response should be authoritative.
- Category taxonomy exists but needs a documented canonical mapping across perfume, cake, dessert, gift_box, bundle, and Build Your Box.
- Large catalog readiness needs server-side pagination, filters, and collection endpoints rather than one broad storefront payload.

### Cart flow

Current state:

- Cart is client-only and persisted in localStorage.
- Standard products merge by product ID unless metadata/separate-line options are present.
- Build Your Box creates separate configured cart lines.

Risks and gaps:

- Cart persistence is convenient but not authoritative.
- Cart state can be tampered with. This is acceptable only if the backend recalculates every purchasable value from server-side product data.
- There is no account-synced cart, cart recovery, reserved stock, or abandoned checkout flow yet.

### Checkout flow

Current state:

- Checkout collects customer contact, delivery, gift message, notes, and payment method.
- UI defaults to COD.
- The API schema accepts both `card` and `cod`.
- Client idempotency key is generated per checkout attempt and reused on retry.

Critical risk:

- `makeOrderFromPayload()` computes subtotal, platform fee, vendor net, shop IDs, and payment status from client-supplied item prices and shop IDs.
- Build Your Box gets server-side validation against selected perfume/treat products, but normal product items are not reloaded/repriced from Product records.
- This allows order total, vendor net, shop attribution, and product snapshot tampering.

Additional gaps:

- Idempotency fingerprint is narrow and should include canonicalized full checkout intent, or preferably be bound after server-side order normalization.
- Guest order access depends on the returned guest token being retained by the browser session.
- Card payment is modeled as `Authorization`, but there is no real gateway authorization.

### Order flow

Current state:

- Order creation deducts stock and stores an order snapshot.
- Order access supports customer ownership, seller shop scope, admin/support access, and guest token access.
- Status transitions are handled through workflow helpers.
- Customer can accept or dispute delivered orders.
- Disputes can freeze seller balance and move into support/resolution logic.
- Delivered orders can trigger referral commissions and seller balance earnings in some paths.

Risks and gaps:

- Order creation authority is the top business/security risk.
- Card orders can be created without real payment authorization.
- Multi-document operations around order creation, stock deduction, seller balances, commissions, and notifications need transaction or reconciliation design for production.
- Guest confirmation needs durable email token/link behavior, not only sessionStorage.

### Delivery flow

Current state:

- Sellers/admins can create and assign drivers.
- Sellers can assign drivers directly or create delivery offers.
- Drivers can accept offers and mark pickup/delivery.
- COD collection and settlement candidates exist.
- Admin can settle driver COD orders.

Critical risk:

- `recordDriverDelivery()` references `safeShopId` without defining it after mutating the order and driver. This is likely a runtime 500 after side effects.

High-risk inconsistencies:

- Seller delivery completion calls `recordDeliveryEarning()`, but the general driver delivery path does not.
- Seller delivery completion ignores `proofOfDeliveryUrl`; general delivery attempts to store it, but the Order schema does not define it.
- Pickup attempts to store `driverAssignment.pickedUpAt`, but the Order schema does not define it.
- Proof-of-delivery and pickup timestamps need one consistent schema and one consistent behavior across seller, driver, and admin paths.

### Admin flow

Current state:

- Admin console is broad: overview, operations, payments, payouts, orders, users, seller pipeline, CRM, drivers, clients, shops, analytics, support, roles, sales reps, audit, merchandising.
- Backend includes audit, reports, seller application, product approval, payout, COD settlement, support, driver, and merchandising APIs.

Risks and gaps:

- Some admin data is mixed live/seed in Mongo mode.
- Admin customer list is derived from seed/customer summaries rather than a fully durable customer model.
- `updateShopPaymentRules()` uses seed repository only, so it does not appear Mongo-persistent.
- Demo admin login hints in the frontend should not be shipped to production environments.
- Payouts are controlled/admin-state only; no real disbursement provider exists yet.

### Seller flow

Current state:

- Seller portal supports login/guarding, onboarding, brand profile, product creation/editing, stock, orders, drivers, customers, analytics, payouts, support.
- Seller edits that change sensitive catalog fields are routed back through approval.
- Seller brand profile/public seller pages exist.

Risks and gaps:

- Seller onboarding/KYC/commercial agreement details are not fully formalized.
- Seller payment rules/contract status need durable Mongo behavior and clearer admin actions.
- Seller financial views rely on ledger logic that needs reconciliation tests and operational docs before production.
- Seller product image upload has MIME/size checks but still needs production storage and media security policy.

## 6. UX and premium gifting experience review

Whiteport Design Studio assessment:

The customer storefront already expresses a strong premium gifting proposition. The visual direction is not a generic marketplace shell. Build Your Box, seller brand pages, curated collections, product detail pairings, occasion messaging, and editorial category moments all support the "premium gift" story.

Strong UX assets:

- Build Your Box is guided, staged, and emotionally clear: choose perfume, choose cake/dessert from the same boutique, add message/allergy/gift wrap, preview the gift, add as one configured item.
- Product detail pages support richer gift decision-making through seller context, personalization notes, and related information.
- Seller brand pages give boutique identity a visible place in the buying journey.
- Homepage/category direction uses real gifting imagery and premium copy.
- Seller/admin/driver/SR apps are role-specific rather than one overloaded interface.

UX gaps:

- Cart and checkout are functional, but not yet at the same premium design maturity as Build Your Box and the storefront.
- Card payment UI/copy exists conceptually while backend cannot process card payments.
- Guest order confirmation feels fragile because access depends on browser session token storage.
- Account wishlist displays are not yet rich enough for a premium shopping account experience.
- Static pages such as offers, journal, fragrance finder, gifting guide, and store locator are not yet backed by mature content/product logic.
- There is no documented WDS Trigger Map, scenario outline, or design-system artifact in `design-artifacts`.
- Accessibility, responsive QA, and visual regression evidence are not documented.

Premium experience opportunity:

The best product wedge is not "marketplace with perfume plus cakes." It is "one coordinated premium gift from a trusted boutique." Build Your Box should become the reference scenario for checkout, order tracking, seller fulfillment, driver handoff, support, and post-delivery customer acceptance.

## 7. Security and authentication risks

Critical and high risks:

- Checkout trusts client prices and shop IDs. This is the most serious business logic issue.
- Card payment can be represented as authorized without gateway authorization.
- Seed mode login auto-creates users and infers `admin`/`seller` role from email text. This is acceptable only for local demo mode and must be impossible in production.
- Production env validation does not require `MONGO_URI`.
- Production CORS can fall back to localhost defaults and still pass validation.
- JWT access and refresh tokens are persisted in localStorage.
- Refresh tokens rotate on the backend, but the frontend refresh path stores only the new access token.
- Public storefront can expose non-live catalog data.
- Reviews can be posted through an optional-auth route and can mark themselves verified.
- Uploads allow seller/admin images with MIME and size validation, but production needs object storage, scanning/validation policy, and a clear public/private media model.

Other risks:

- RBAC exists through roles and permissions, but a full endpoint permission matrix is not documented.
- Audit logging exists but should be mapped to sensitive admin actions and security events.
- Multi-document finance/order operations need transaction/reconciliation design.
- Password reset exists, but production email, token handling, abuse controls, and monitoring need operational validation.

## 8. Testing gaps

Existing automated tests:

- Backend node tests exist for finance, marketplace services, orders, support, and workflow helpers.
- Current discovered test files cover COD settlement, commission reversal, payouts, seller balance, admin operations summary, brand profiles, collections, events, featured placements, seller performance, Build Your Box validation, order stock, order access, order idempotency, support conversion/service, and order/product workflows.
- CI runs backend tests with `node --test` and builds all Vite apps.

Major gaps:

- No root `npm test` script and no backend package test script.
- No Playwright/Cypress end-to-end smoke tests.
- No API integration suite against real MongoDB.
- No checkout tampering/security tests for price, shop ID, product status, and stock.
- No production-env validation tests.
- No auth refresh rotation test.
- No public storefront authorization/data-exposure test.
- No delivery completion regression test covering the undefined `safeShopId` path.
- No proof-of-delivery schema persistence test.
- No complete order-to-ledger-to-payout reconciliation test under Mongo mode.
- No visual regression or responsive screenshot suite for the premium storefront.
- No accessibility test coverage documented.
- CI lacks lint, typecheck/static analysis, secret scanning, dependency vulnerability scanning, and container runtime smoke tests.

BMAD Test Architect risk note:

- Use a probability x impact risk model. Checkout authority, production seed safety, payment state, and delivery completion are P1 risks because they combine high impact with realistic likelihood.
- The first automation expansion should target purchase flow integrity before broad UI coverage.

## 9. Documentation gaps

Existing docs:

- `README.md`
- `docs/architecture.md`
- `docs/system-status.md`
- `docs/system-improvement-plan.md`
- `docs/manual-uat-script.md`
- `docs/environment.md`
- milestone/status docs

Gaps and inconsistencies:

- Architecture doc is too thin for the amount of backend behavior now present.
- `docs/system-status.md` contains stale or contradictory checkout/order statements compared with current source.
- No OpenAPI/API contract documentation.
- No database schema/data dictionary.
- No endpoint permission matrix.
- No production deployment runbook.
- No backup/restore plan.
- No media storage/security policy.
- No payment/COD/payout architecture decision record.
- No support/dispute operating procedure.
- No seller onboarding/KYC/commercial policy documentation.
- No WDS Trigger Map, UX scenario outlines, or design-system specification artifacts in `design-artifacts`.
- No release checklist tying docs, tests, environment, and launch readiness together.
- `.DS_Store` files are present in docs folders and should be cleaned up later.

## 10. Priority fixes

### Critical

1. Make the backend the authority for all order items, prices, shop IDs, product status, stock, fees, and vendor net. Normal checkout items must be loaded and validated from Product records before order creation.
2. Disable or reject API-level card checkout until a real payment gateway authorization exists, or integrate the gateway before allowing `paymentMethod: "card"`.
3. Fix `recordDriverDelivery()` so it does not reference undefined `safeShopId`; ensure delivery completion returns success after mutation and notification.
4. Add production hard stops: require `MONGO_URI`, real JWT secrets, real CORS origins, and no seed/demo auth behavior in production.

### High

1. Filter public storefront data server-side to live/approved products, eligible shops, and published public profiles only.
2. Fix refresh token rotation in the shared API client, and evaluate moving tokens from localStorage to secure httpOnly cookie sessions.
3. Add `proofOfDeliveryUrl` and `pickedUpAt` to the Order schema, then make seller/general delivery paths consistent.
4. Ensure all delivered-order paths call the same seller earning, commission, notification, and audit side effects.
5. Require verified purchase logic for reviews; do not accept client-supplied `verified`.
6. Make shop payment rules and contract actions Mongo-persistent.
7. Add E2E smoke tests for COD checkout, guest/account confirmation, seller fulfillment, driver pickup/delivery, admin COD settlement, support dispute, and payout release.
8. Add API tests for checkout tampering, public storefront filtering, production env validation, auth refresh, and delivery completion.
9. Formalize upload storage for production and require S3/R2 or equivalent object storage outside local disk.
10. Reconcile docs with current source and create API/data/permissions documentation.

### Medium

1. Add root/backend `test` scripts and CI lint/typecheck/static checks.
2. Add Mongo integration tests for order, stock, finance, delivery, support, and admin flows.
3. Add server-side category/search pagination for the customer storefront.
4. Improve guest order confirmation with durable email links and token expiry/reissue behavior.
5. Improve account wishlist/order history richness.
6. Create design specs for cart, checkout, account, support, seller onboarding, and driver handoff.
7. Add transaction/reconciliation strategy for finance and stock mutations.
8. Fix admin reporting/count issues caused by status casing mismatches.
9. Document and test all workflow transitions.
10. Add observability for failed notifications, email, payout, upload, and delivery side effects.

### Low

1. Clean `.DS_Store` files and update ignore hygiene.
2. Consider moving customer routing to React Router when route complexity grows.
3. Add CMS/content strategy for offers, journal, fragrance finder, and gifting guide.
4. Add visual regression snapshots for key premium pages.
5. Add SEO structured data for products, sellers, collections, and gift guides.
6. Add more polished empty/loading/error states across admin/seller/driver portals.

## 11. Recommended BMAD workflow to continue

Recommended sequence:

1. BMAD Analyst: create or update the Product Brief/PRD for the MVP launch boundary. Focus on COD-first purchase, premium gifting, Build Your Box, seller onboarding, delivery ownership, support/disputes, and payout expectations.
2. Whiteport Design Studio: create Trigger Map and scenario outlines for the core loops: gift discovery, Build Your Box, cart/checkout, order tracking, customer acceptance/dispute, seller fulfillment, driver delivery, and admin settlement. Then produce UX specs for cart, checkout, account, and seller onboarding.
3. BMAD Architect: create architecture decisions for order authority, payment/COD lifecycle, seller ledger/payouts, auth/session storage, production environment safety, storage/media, notifications/email, and background job/reconciliation strategy.
4. BMAD Test Architect: create a risk-based test strategy and traceability matrix. Prioritize P1 risks: checkout tampering, production seed safety, card payment state, driver delivery completion, public catalog exposure, refresh rotation, and finance reconciliation.
5. BMAD Epics/Stories: turn the critical/high fixes into implementation-ready stories. Keep stories narrow and verifiable.
6. BMAD Dev Story or Quick Dev: implement critical fixes one at a time, with tests added in the same story.
7. Checkpoint Preview/Code Review: after each critical fix, run a human-readable checkpoint and adversarial review before moving to the next production risk.

Suggested first implementation epic:

- Epic: Purchase Integrity and Production Safety.
- Story 1: Server-side order normalization and repricing.
- Story 2: Card checkout backend lock/gateway boundary.
- Story 3: Production env hard stops and seed/demo isolation.
- Story 4: Delivery completion consistency and proof-of-delivery persistence.
- Story 5: Public storefront filtering.
- Story 6: Risk-based E2E/API smoke suite.

