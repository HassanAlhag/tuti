# Target Architecture

Source: `docs/bmad-system-review.md`  
Status: planning draft  
Date: 2026-06-12

## Architecture goal

The target architecture makes the backend the source of truth for marketplace commerce while preserving the existing monorepo and role-specific apps. The immediate architecture priority is not a framework rewrite. It is to define correct ownership boundaries for orders, pricing, payment/COD, seller ledger, delivery, storefront exposure, auth/session handling, production safety, uploads, and notifications.

## Core principles

- Server-side authority for every value that affects money, stock, access, settlement, or public catalog exposure.
- Explicit lifecycle states for payment, COD, order fulfillment, delivery, disputes, and payout.
- Idempotent commands for checkout, delivery completion, COD settlement, payout actions, and notification/email dispatch.
- Append-only evidence for financial events.
- Public APIs return public projections, not raw operational records.
- Production configuration must fail closed.
- Every side effect that can fail after a mutation needs retry, reconciliation, or audit evidence.

## System boundary

The current monorepo can remain:

- Customer web app: discovery, gifting, cart, checkout, account, support.
- Seller app: product, fulfillment, delivery, payout, support.
- Admin app: operations, settlement, users, audit, reports, merchandising.
- Driver app: pickup, delivery, COD capture, delivery history.
- Sales rep app: referrals and seller acquisition.
- Express API: commerce authority, workflow orchestration, data access, auth, notifications.
- MongoDB: durable operational store.
- Object storage: production media storage.
- Email provider: transactional email.

Future background worker support is recommended for email/notification retries, media processing, reconciliation, and reports, but MVP can start with synchronous service calls plus explicit reconciliation tests if the risks are accepted.

## Data authority map

| Domain | Authority | Client responsibility |
| --- | --- | --- |
| Product price/status/stock | Backend Product records | Display current values and send product IDs/quantities |
| Cart contents | Client for convenience, backend for validation | Persist draft intent only |
| Order item snapshot | Backend order service | Send selected product IDs and allowed configuration |
| Platform fee/vendor net | Backend pricing service | Display returned totals |
| Payment status | Backend payment/COD service | Select allowed method only |
| COD collection/settlement | Backend delivery/finance services | Driver/admin input only |
| Seller balance | Backend ledger service | Display balances and transactions |
| Public catalog | Backend public projection/query service | Render only returned public data |
| Auth/session | Backend auth service plus shared client session layer | Store/session behavior according to selected token architecture |
| Upload media URL | Backend storage service | Upload file only through authorized endpoint |
| Notifications/email | Backend notification/email services | Display inbox and links |

## Order authority

The order service should own order creation as a command:

1. Accept customer details, delivery details, payment method, idempotency key, and an item intent list.
2. Treat standard item intent as `{ productId, quantity, metadata? }`.
3. Treat Build Your Box intent as `{ type: build_your_box, perfumeProductId, treatProductId, metadata? }`.
4. Load all referenced Product records from Mongo or seed repository.
5. Validate product status, stock, category, seller/shop eligibility, Build Your Box same-shop rule, and quantity.
6. Calculate canonical item snapshots, subtotal, platform fee, vendor net, shop IDs, and stock lines.
7. Deduct stock and create the order inside the safest available transaction boundary.
8. Return the authoritative order snapshot to the client.

Order creation must reject client-provided price, product name, shop ID, status, vendor net, platform fee, or payment status.

## Checkout pricing

Introduce or formalize a pricing layer inside the order module:

- `normalizeCheckoutIntent(payload)`
- `loadCheckoutProducts(intent)`
- `priceStandardItem(product, quantity)`
- `priceBuildYourBox(perfume, treat, configuration)`
- `calculateMarketplaceFees(subtotal, shopRules)`
- `buildOrderSnapshot(normalizedIntent, pricedLines)`

Pricing rules:

- Price comes from Product records at checkout time.
- Product display price in the browser is informational only.
- Build Your Box total is the sum of validated component products unless a future explicit bundle pricing rule is introduced.
- Fees must be deterministic and test-covered.
- Idempotency fingerprint should be based on canonical normalized intent, not raw client payload.
- The response should include authoritative totals for confirmation.

## Payment and COD lifecycle

MVP lifecycle:

- `paymentMethod: cod` is the only accepted checkout method.
- API rejects `paymentMethod: card` with a clear 422/409 style response until a gateway is integrated.
- New COD order starts with `paymentStatus: COD pending`.
- Driver delivery can set COD collected amount.
- Admin settlement turns collected COD into seller ledger credit if eligibility checks pass.
- Disputes can hold or release balance according to resolution.

Future card lifecycle:

- Card checkout creates a gateway payment intent before order confirmation.
- Order stores provider, intent ID, authorization status, capture status, refund status, and failure reason.
- Capture/refund are server-side commands.
- Seller ledger credit occurs only after valid capture and delivery/release policy.

COD architecture states:

- COD pending: order created, cash not collected.
- COD collected: driver reports cash collected at delivery.
- COD settlement pending: collected cash awaits admin settlement.
- COD settled: admin settled cash and seller ledger credit created.
- COD disputed: settlement/credit is held or reversal-reviewed.

## Seller ledger and payouts

Seller finance should be ledger-first:

- `SellerTransaction` is the append-only source of financial evidence.
- Shop balance fields can be denormalized summaries, but must be reconcilable from ledger entries.
- Every financial event has idempotency metadata, source entity, actor, timestamp, and notes.
- Delivery credit, COD credit, dispute hold, hold release, refund debit, payout debit, and adjustments are distinct transaction types.
- Payout records reference ledger movement and should never create money movement without transaction evidence.

MVP payout policy:

- Admin-controlled payout records only.
- No automated disbursement provider.
- Payout statuses: pending, processing, completed, failed, cancelled.
- Payout eligibility depends on available balance, dispute status, COD settlement, hold period, and refund exposure.
- Admin payout actions are audited.

Recommended reconciliation:

- Daily or manual reconciliation job/report compares orders, delivery state, COD settlement, ledger transactions, shop balances, and payout records.
- Reconciliation failures create admin-visible exceptions.

## Driver delivery

Delivery should use one consistent model across seller, driver, and admin paths.

Required delivery fields:

- driver ID, name, phone
- assigned at
- picked up at
- delivered at
- proof of delivery URL
- delivery note
- COD collected flag
- COD amount
- COD settled at/by/reference

Delivery command flow:

1. Assign driver or create delivery offer.
2. Driver accepts offer or seller/admin directly assigns.
3. Driver confirms pickup, moving order to Shipped.
4. Driver completes delivery, moving order to Delivered.
5. Delivery completion records proof, COD data, status history, driver stats, seller earning policy, commissions, notification, and audit.
6. COD settlement remains an admin command.

Delivery completion must be idempotent or explicitly reject duplicates before mutation. It must not mutate order/driver and then fail because of notification, audit, or undefined variables. Non-critical side effects should be retried or logged without reversing a valid delivery completion.

## Public storefront

Public storefront APIs should return public read models:

- Only products with status `Live`.
- Only eligible seller shops/profiles.
- Only published public seller brand profiles.
- Only public review fields.
- No admin/seller-only fields.
- No draft, pending, rejected, hidden, suspended, or deleted records.

Search and category APIs should use server-side filters and pagination. The customer app can still cache and do local refinements for small result sets, but the API response must be safe by default.

Recommended endpoints:

- `GET /api/marketplace/storefront` for launch-ready homepage payload.
- `GET /api/marketplace/search` for paged catalog search.
- `GET /api/public/sellers/:slug` for seller public profile.
- `GET /api/public/sellers/:slug/products` for live seller products only.
- Future: dedicated category, collection, and product detail public endpoints.

## Auth and session storage

Short-term target:

- Keep JWT access tokens short-lived.
- Refresh token rotation must update both access and refresh token client-side.
- Replay of old refresh tokens must fail.
- Logout clears stored tokens and revokes refresh token where possible.
- Role and permission claims must be normalized server-side.
- Idle timeout remains enabled for admin, seller, driver, and sales rep apps.

Preferred production target:

- Move refresh token to secure, httpOnly, sameSite cookie.
- Use CSRF protection for cookie-authenticated unsafe requests.
- Keep access token in memory or issue via backend session refresh.
- Avoid persistent localStorage tokens for privileged portals.

RBAC:

- Document endpoint role/permission matrix.
- Enforce permissions server-side.
- Audit admin/support role changes and sensitive operations.

## Production environment safety

Production must fail closed when required configuration is absent.

Required production checks:

- `NODE_ENV=production` requires `MONGO_URI`.
- `NODE_ENV=production` requires non-development JWT secrets.
- `NODE_ENV=production` requires explicit CORS origins and must not fall back to localhost.
- `NODE_ENV=production` disables seed/demo login creation.
- `NODE_ENV=production` requires production upload storage config.
- `NODE_ENV=production` requires email provider config or an explicit launch waiver.
- Health endpoint must not expose secrets and should clearly identify database mode.

Seed mode:

- Allowed only for local development, test fixtures, and demo environments explicitly marked non-production.
- Demo auto-login must be disabled outside local/demo.
- Admin demo credentials must not be visible in production UI.

## Media upload and storage

Production media should use S3/R2 or equivalent object storage:

- No production local disk uploads.
- File size limits remain enforced.
- MIME type validation plus content sniffing is preferred.
- Only JPEG, PNG, and WebP are accepted for launch unless expanded intentionally.
- Object keys should include environment, owner/shop ID where useful, date partition, and random filename.
- Public product images can be served via CDN.
- Private/proof-of-delivery media should use private storage and signed URLs if it contains sensitive delivery evidence.
- Upload events should be audited for seller/admin users.

Future media controls:

- Image processing/resizing.
- Malware scanning or provider-level scanning.
- Orphan cleanup for replaced images.
- Moderation review for seller-uploaded public assets.

## Notifications and email

Notifications should be treated as side effects with retry/reconciliation:

- In-app notifications can be created synchronously if failure does not break the core command.
- Email should use templates and a provider configured per environment.
- Guest order confirmation email must include a durable secure link or token flow.
- Support/dispute, order status, seller order, delivery, payout, and settlement events need templates.
- Notification creation should be idempotent when tied to a unique domain event.

Recommended future pattern:

- Add an outbox collection for domain events.
- A worker processes email/in-app notification retries.
- Admin can inspect failed notification/email attempts.

## Architecture decisions to record

- ADR-001: Backend is order/pricing authority.
- ADR-002: COD-only MVP until gateway authorization exists.
- ADR-003: Seller ledger is append-only financial evidence.
- ADR-004: Production cannot run in seed-memory mode.
- ADR-005: Public storefront exposes public projections only.
- ADR-006: Delivery completion uses one shared command path and schema.
- ADR-007: Production media storage uses object storage, not local disk.
- ADR-008: Refresh token rotation must be reliable before launch; cookie sessions are the preferred hardening path.

