# Implementation Epics and Stories

Source: `docs/bmad-system-review.md`  
Status: planning draft  
Date: 2026-06-12

## Implementation guidance

These stories convert the critical and high-priority review findings into implementation-ready work. They are intentionally scoped for BMAD Dev Story execution later. This document does not authorize source code edits by itself.

Story risk levels:

- Critical: launch blocker or money/security integrity issue.
- High: likely production risk or major trust/reliability issue.
- Medium: important hardening or follow-on work.

## Epic 1: Purchase Integrity and Payment Boundary

### Story 1.1: Server-side order normalization and repricing

Goal: Make the backend the authority for order items, prices, shop IDs, product status, stock, platform fee, vendor net, and order snapshots.

Files likely affected:

- `backend/src/modules/orders/orders.service.js`
- `backend/src/modules/orders/orders.routes.js`
- `backend/src/modules/orders/buildYourBox.validation.js`
- `backend/src/modules/orders/orderStock.js`
- `backend/src/models/Order.js`
- `backend/src/models/Product.js`
- `apps/web/src/features/pages/sitemap/CartCheckoutPage.jsx`
- `apps/web/src/features/pages/sitemap/sitemapPageShared.jsx`
- `packages/shared/api/client.js`

Risk level: Critical

Acceptance criteria:

- Standard checkout payload no longer accepts authoritative product name, shop ID, price, fee, vendor net, or payment status from the client.
- Backend loads each Product record by ID and validates status, stock, category, shop, and quantity.
- Backend builds order item snapshots from Product records.
- Backend calculates subtotal, platform fee, vendor net, and shop IDs.
- Build Your Box validation continues to enforce same-shop perfume plus treat pairing.
- Idempotency compares canonical normalized checkout intent.
- Error responses are customer-safe and explain review/retry when checkout changed.

Test cases:

- Price tamper low and high.
- Shop ID tamper.
- Product name tamper.
- Draft/rejected product checkout.
- Out-of-stock checkout.
- Build Your Box cross-shop tamper.
- Build Your Box total tamper.
- Duplicate idempotency key same intent.
- Duplicate idempotency key changed intent.

Rollback notes:

- Keep the old payload shape behind tests only if needed for compatibility.
- If frontend changes fail, backend must still reject unsafe client authority rather than accepting old behavior.
- Roll back by restoring previous order service only in non-production; production should not launch with client-priced orders.

### Story 1.2: Lock card checkout until gateway support exists

Goal: Prevent card payment authorization state from being created without a real payment gateway.

Files likely affected:

- `backend/src/modules/orders/orders.service.js`
- `backend/src/models/Order.js`
- `packages/shared/constants/commerce.js`
- `apps/web/src/features/pages/sitemap/CartCheckoutPage.jsx`
- `docs/environment.md`

Risk level: Critical

Acceptance criteria:

- API rejects `paymentMethod: card` when gateway feature flag/config is absent.
- Rejected card attempts do not create orders or deduct stock.
- UI presents COD as the only enabled checkout method for MVP.
- Payment copy does not imply card authorization is available.
- Any future card enablement is controlled by explicit backend config and tests.

Test cases:

- API card checkout rejected.
- API COD checkout accepted.
- Card rejection does not change stock.
- UI cannot submit card checkout in MVP mode.
- Existing card constants do not enable card accidentally.

Rollback notes:

- If UI rollout needs to be rolled back, backend rejection remains active.
- Card can be re-enabled only through a gateway integration story with provider tests.

### Story 1.3: Harden checkout idempotency fingerprint

Goal: Ensure checkout retries are safe and changed checkout intent is detected after server-side normalization.

Files likely affected:

- `backend/src/modules/orders/orders.service.js`
- `backend/src/models/Order.js`
- `backend/src/modules/orders/orders.idempotency.test.js`

Risk level: High

Acceptance criteria:

- Fingerprint is generated from canonical normalized order intent.
- Fingerprint includes customer identity/email, product IDs, quantities, Build Your Box components, delivery details if required, and payment method.
- Same idempotency key plus same canonical intent returns existing order.
- Same idempotency key plus changed canonical intent returns conflict.
- Fingerprint does not include unstable display-only fields.

Test cases:

- Retry same request.
- Retry with changed quantity.
- Retry with changed Build Your Box component.
- Retry with changed delivery detail if considered order intent.
- Retry with changed client price that normalizes to same server price.

Rollback notes:

- Existing idempotency key field can remain.
- If fingerprint expansion causes false conflicts, narrow canonical fields but do not remove conflict detection.

## Epic 2: Production Safety and Auth Reliability

### Story 2.1: Production environment hard stops and seed isolation

Goal: Make production fail closed when required durable config is absent and prevent seed/demo auth behavior outside local/demo mode.

Files likely affected:

- `backend/src/config/env.js`
- `backend/src/config/db.js`
- `backend/src/modules/auth/auth.service.js`
- `backend/src/app.js`
- `.env.example`
- `docs/environment.md`
- `docker-compose.yml`
- `.github/workflows/ci.yml`

Risk level: Critical

Acceptance criteria:

- `NODE_ENV=production` requires `MONGO_URI`.
- Production requires explicit non-local CORS origins.
- Production rejects development JWT secrets.
- Production disables seed auto-login/demo user creation.
- Production upload and email requirements are explicit or launch-waivered.
- Health endpoint cannot report seed-memory in a successful production boot.
- Tests cover production env validation.

Test cases:

- Production without Mongo fails.
- Production without CORS origins fails.
- Production with development JWT secret fails.
- Production seed login auto-create fails.
- Development seed mode still works for local demo.

Rollback notes:

- If deployment config is incomplete, fix environment rather than weakening production validation.
- Keep local development behavior behind `NODE_ENV=development` or explicit demo mode.

### Story 2.2: Fix refresh token rotation in shared client

Goal: Ensure rotated refresh tokens are stored and stale refresh tokens are rejected without breaking sessions.

Files likely affected:

- `packages/shared/api/client.js`
- `packages/shared/store/authStore.js`
- `backend/src/modules/auth/auth.service.js`
- `backend/src/modules/auth/auth.routes.js`
- Apps using `useAuthStore`

Risk level: High

Acceptance criteria:

- Refresh response updates both access token and refresh token.
- Old refresh token cannot be reused after rotation.
- Failed refresh clears auth state safely.
- Login/logout behavior remains unchanged for all apps.
- Admin/seller/driver/SR idle timeout still works.

Test cases:

- Login then refresh once.
- Refresh twice using stored rotated token.
- Reuse old refresh token fails.
- Invalid refresh clears auth.
- Logout clears stored tokens.

Rollback notes:

- If client update breaks a portal, backend can temporarily stop rotating only in non-production while client fix is corrected.
- Production preference is reliable rotation, not long-lived static refresh tokens.

### Story 2.3: Define secure session storage migration path

Goal: Prepare a safe migration from persistent localStorage tokens toward httpOnly refresh-token cookies for privileged portals.

Files likely affected:

- `backend/src/modules/auth/auth.routes.js`
- `backend/src/modules/auth/auth.service.js`
- `backend/src/app.js`
- `packages/shared/api/client.js`
- `packages/shared/store/authStore.js`
- `docs/bmad/02-target-architecture.md`
- `docs/environment.md`

Risk level: High

Acceptance criteria:

- Architecture decision is recorded for current MVP token handling and future cookie-session target.
- Current localStorage risk is documented with mitigations.
- Cookie-session implementation story is ready if chosen.
- CSRF requirements are identified if httpOnly cookie refresh is introduced.

Test cases:

- Documentation review only for this story unless implementation is included later.
- Threat model checklist covers XSS, CSRF, refresh replay, logout, idle timeout.

Rollback notes:

- This can remain an architecture decision if launch chooses short-term token storage.
- Do not partially ship cookie sessions without CSRF and CORS validation.

## Epic 3: Delivery Completion and Finance Consistency

### Story 3.1: Fix driver delivery completion runtime failure

Goal: Remove the undefined `safeShopId` failure path and ensure delivery completion succeeds after valid mutation.

Files likely affected:

- `backend/src/modules/drivers/drivers.service.js`
- `backend/src/modules/drivers/drivers.routes.js`
- `backend/src/modules/notifications/notifications.service.js`

Risk level: Critical

Acceptance criteria:

- `recordDriverDelivery()` no longer references undefined variables.
- Valid assigned driver delivery returns success.
- Notification failure cannot turn a valid delivery completion into a 500 unless explicitly required.
- Duplicate delivery completion is rejected or idempotent before duplicate side effects.
- Seed and Mongo paths behave consistently.

Test cases:

- Mongo assigned driver completes delivery.
- Seed assigned driver completes delivery.
- Notification service error path.
- Duplicate delivery completion.
- Driver not assigned to order.

Rollback notes:

- If notification decoupling causes issues, keep delivery mutation successful and log notification failure.
- Do not roll back to a state where delivery mutates and returns 500.

### Story 3.2: Persist proof-of-delivery and pickup fields

Goal: Align Order schema and delivery services around proof-of-delivery and pickup persistence.

Files likely affected:

- `backend/src/models/Order.js`
- `backend/src/modules/drivers/drivers.service.js`
- `apps/driver/src`
- `apps/seller/src`
- `apps/admin/src`

Risk level: High

Acceptance criteria:

- Order driver assignment schema includes `pickedUpAt` and `proofOfDeliveryUrl`.
- Pickup persists in Mongo and seed mode.
- Delivery proof persists in Mongo and seed mode.
- Seller, driver, and admin views can read the same fields.
- Existing orders without these fields remain readable.

Test cases:

- Pickup persistence.
- Delivery proof persistence.
- Existing order without fields.
- Seller delivery path proof.
- General driver delivery path proof.

Rollback notes:

- Schema fields are additive and safe to retain.
- If UI display fails, keep backend persistence and hide UI display temporarily.

### Story 3.3: Unify delivered-order side effects

Goal: Ensure every delivered-order path triggers consistent seller earning, commission, notification, audit, and driver updates.

Files likely affected:

- `backend/src/modules/drivers/drivers.service.js`
- `backend/src/modules/orders/orders.service.js`
- `backend/src/modules/finance/sellerBalance.js`
- `backend/src/modules/orders/orderCommissions.js`
- `backend/src/modules/audit/audit.service.js`
- `backend/src/modules/notifications/notifications.service.js`

Risk level: High

Acceptance criteria:

- One shared helper or clearly equivalent flow handles delivered-order side effects.
- Seller delivery path and general driver path produce the same finance/commission policy result.
- Non-critical side-effect failures are logged and reconcilable.
- Side effects are idempotent and do not duplicate ledger or commission records.
- Audit records exist for delivery completion and settlement-relevant events.

Test cases:

- Seller driver delivery.
- General driver delivery.
- COD delivered order.
- Non-COD delivered order remains disabled/controlled until gateway support.
- Duplicate delivery side effect prevention.
- Notification failure.

Rollback notes:

- If full unification is too risky, first add tests around current paths, then refactor behind tests.
- Ledger idempotency must remain active during rollback.

### Story 3.4: Add finance reconciliation coverage

Goal: Prove seller ledger, COD settlement, disputes, refunds, and payouts can be reconciled.

Files likely affected:

- `backend/src/modules/finance/*`
- `backend/src/modules/reports/*`
- `backend/src/modules/orders/orders.service.js`
- `backend/src/modules/drivers/drivers.service.js`
- `.github/workflows/ci.yml`

Risk level: High

Acceptance criteria:

- COD settlement creates exactly one seller credit.
- Disputed orders freeze or hold balance correctly.
- Resolution release/refund creates expected ledger entries.
- Payout debit links to payout record.
- Reconciliation report identifies mismatches.
- Tests cover duplicate command prevention.

Test cases:

- COD collect then settle.
- Duplicate settlement attempt.
- Dispute after delivery.
- Resolution release.
- Resolution refund.
- Payout completed.
- Report mismatch fixture.

Rollback notes:

- Tests can ship before full reconciliation UI.
- If report changes are risky, keep service-level reconciliation tests first.

## Epic 4: Public Catalog and Marketplace Trust

### Story 4.1: Filter public storefront server-side

Goal: Ensure public storefront APIs expose only live, approved, public marketplace data.

Files likely affected:

- `backend/src/modules/marketplace/marketplace.service.js`
- `backend/src/modules/marketplace/marketplace.routes.js`
- `backend/src/modules/marketplace/brandProfile.service.js`
- `apps/web/src/App.jsx`
- `apps/web/src/features/storefront/*`

Risk level: High

Acceptance criteria:

- Storefront API returns only live products.
- Storefront API excludes draft, rejected, needs-approval, hidden, and suspended seller data.
- Public seller products return only live products.
- Public seller profiles return only published public fields.
- Frontend does not rely on client filtering for safety.

Test cases:

- Mixed product statuses.
- Suspended/hidden shop.
- Unpublished seller profile.
- Search endpoint remains live-only.
- Customer storefront renders filtered payload.

Rollback notes:

- If frontend expects hidden fields, add explicit public projection fields rather than returning raw records.
- Public API safety takes precedence over old storefront completeness.

### Story 4.2: Require trustworthy review verification

Goal: Prevent guest/client payloads from marking reviews as verified.

Files likely affected:

- `backend/src/modules/marketplace/marketplace.routes.js`
- `backend/src/modules/marketplace/marketplace.service.js`
- `backend/src/models/Review.js`
- `backend/src/models/Order.js`
- `apps/web/src/features/reviews/*`

Risk level: High

Acceptance criteria:

- `verified` is never accepted from client payload as authoritative.
- Verified review status is derived from eligible completed/accepted customer orders.
- Guest reviews are either disabled or clearly unverified.
- Duplicate review rules are defined for one product/order/customer.
- Product verified review count cannot be inflated by client input.

Test cases:

- Guest sends `verified: true`; stored review is unverified or rejected.
- Customer with no purchase sends review.
- Customer with accepted order sends verified review.
- Duplicate review attempt.
- Product rating/count update remains correct.

Rollback notes:

- If purchase verification is too large, first block client-supplied `verified` and mark all reviews unverified.

### Story 4.3: Make shop payment rules and contract actions Mongo-persistent

Goal: Ensure admin seller payment/contract operations persist in production mode.

Files likely affected:

- `backend/src/modules/marketplace/marketplace.service.js`
- `backend/src/modules/marketplace/marketplace.routes.js`
- `backend/src/models/Shop.js`
- `apps/admin/src`
- `apps/seller/src`

Risk level: High

Acceptance criteria:

- `updateShopPaymentRules()` works in Mongo mode.
- Contract status actions are clearly named and persisted.
- Seller-facing payment/contract notices reflect durable data.
- Admin actions are audited.
- Seed mode behavior remains available for local demo.

Test cases:

- Mongo update payment rules.
- Seed update payment rules.
- Contract status update.
- Invalid payment rules validation.
- Audit event creation.

Rollback notes:

- Add Mongo path without removing seed path.
- If UI copy is not ready, keep backend persistence and expose current labels until follow-up.

### Story 4.4: Formalize production media storage

Goal: Require production object storage and define safe upload behavior for seller/admin media.

Files likely affected:

- `backend/src/shared/storage.js`
- `backend/src/app.js`
- `backend/src/config/env.js`
- `.env.example`
- `docs/environment.md`
- `apps/seller/src`
- `apps/admin/src`

Risk level: High

Acceptance criteria:

- Production requires configured object storage or explicit launch waiver.
- Local disk upload remains dev-only.
- Upload MIME and size validation remain enforced.
- Upload response includes stable public URL for product media.
- Proof-of-delivery media privacy decision is documented before storing sensitive proof publicly.

Test cases:

- Production without object storage fails or warns according to launch decision.
- Dev local upload still works.
- Invalid MIME rejected.
- Oversized file rejected.
- S3/R2 config path uses expected provider.

Rollback notes:

- If object storage rollout fails, production launch should pause or use explicit waiver with limited seller media changes.
- Do not silently fall back to local disk in production.

## Epic 5: Launch QA, CI, and Documentation

### Story 5.1: Add test scripts and CI gates for launch risks

Goal: Make critical backend tests easy to run locally and consistently in CI.

Files likely affected:

- `package.json`
- `backend/package.json`
- `.github/workflows/ci.yml`
- `backend/src/**/*.test.js`

Risk level: High

Acceptance criteria:

- Root `npm test` runs backend tests.
- Backend package `npm test` runs backend tests.
- CI uses package scripts rather than inline find command where practical.
- P1 test suites run on pull requests.
- CI failure output is understandable.

Test cases:

- Local `npm test`.
- Workspace backend `npm test`.
- CI backend test job.
- Empty/no-test behavior is not silently passing.

Rollback notes:

- If workspace test script causes CI issues, keep CI direct command temporarily while preserving backend package script.

### Story 5.2: Add E2E launch smoke suite

Goal: Cover the core COD marketplace loop through browser automation.

Files likely affected:

- `package.json`
- `.github/workflows/ci.yml`
- `tests/e2e/*` or project-selected E2E folder
- `apps/web`
- `apps/seller`
- `apps/admin`
- `apps/driver`

Risk level: High

Acceptance criteria:

- E2E suite can run against local dev or CI test environment.
- Smoke covers customer COD checkout, Build Your Box, seller fulfillment, driver delivery, admin settlement, customer accept/dispute.
- Screenshots/traces are retained on failure.
- Test data setup is deterministic.
- Suite is documented for local execution.

Test cases:

- Guest COD standard order.
- Guest COD Build Your Box order.
- Seller Ready for Delivery.
- Driver pickup/delivery.
- Admin COD settlement.
- Customer accept.
- Customer dispute/support.

Rollback notes:

- If full multi-portal E2E is unstable, keep API tests and split E2E into smaller portal-specific smoke tests.

### Story 5.3: Add API/Mongo integration tests for P1 risks

Goal: Prove launch-critical behavior against durable persistence, not only isolated services.

Files likely affected:

- `backend/src/modules/orders/*.test.js`
- `backend/src/modules/drivers/*.test.js`
- `backend/src/modules/marketplace/*.test.js`
- `backend/src/modules/auth/*.test.js`
- `backend/src/modules/finance/*.test.js`
- `.github/workflows/ci.yml`
- `docker-compose.yml`

Risk level: High

Acceptance criteria:

- Mongo integration job can create isolated test database.
- Tests cover checkout tampering, public catalog exposure, driver delivery completion, refresh rotation, and finance reconciliation.
- Test data is isolated and cleaned up.
- CI can run integration tests deterministically.

Test cases:

- See `docs/bmad/03-risk-based-test-strategy.md` P1/P2 test plan.

Rollback notes:

- If Mongo CI is slow, run service tests on every PR and Mongo integration on protected branches until performance is improved.

### Story 5.4: Create source-of-truth API, data, and permission docs

Goal: Reconcile current docs with source behavior and document launch contracts.

Files likely affected:

- `docs/architecture.md`
- `docs/system-status.md`
- `docs/environment.md`
- `docs/manual-uat-script.md`
- New docs under `docs/bmad/` or `docs/api/`

Risk level: High

Acceptance criteria:

- Architecture doc reflects current backend modules and target decisions.
- API contract docs exist for checkout, order, delivery, support, seller/admin finance, auth, and storefront.
- Data dictionary exists for Product, Order, Shop, User, Driver, SellerTransaction, Payout, SupportTicket.
- Endpoint role/permission matrix exists.
- Production launch checklist ties env, tests, UAT, storage, email, and seed safety together.
- Stale contradictory statements are removed or marked superseded.

Test cases:

- Documentation review checklist.
- Cross-check key docs against source routes/models.
- BMAD checkpoint preview before implementation continues.

Rollback notes:

- Keep old docs only if marked superseded.
- Prefer linking from existing docs to new source-of-truth sections over duplicating conflicting content.

## Recommended implementation order

1. Story 2.1: Production environment hard stops and seed isolation.
2. Story 1.2: Lock card checkout until gateway support exists.
3. Story 1.1: Server-side order normalization and repricing.
4. Story 3.1: Fix driver delivery completion runtime failure.
5. Story 4.1: Filter public storefront server-side.
6. Story 2.2: Fix refresh token rotation in shared client.
7. Story 3.2: Persist proof-of-delivery and pickup fields.
8. Story 3.3: Unify delivered-order side effects.
9. Story 4.2: Require trustworthy review verification.
10. Story 4.3: Make shop payment rules and contract actions Mongo-persistent.
11. Story 4.4: Formalize production media storage.
12. Story 5.1: Add test scripts and CI gates.
13. Story 5.3: Add API/Mongo integration tests.
14. Story 5.2: Add E2E launch smoke suite.
15. Story 5.4: Create source-of-truth API, data, and permission docs.

