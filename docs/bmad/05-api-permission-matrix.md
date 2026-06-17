# API Permission Matrix

Date: 2026-06-17  
Scope: Backend route permissions reviewed from `backend/src/app.js`, `backend/src/middleware/auth.js`, and `backend/src/modules/**/*.routes.js`.

This document is a documentation snapshot, not an enforcement mechanism. Route-level middleware is listed separately from service-level ownership checks. When ownership or permission behavior was not confirmed from the route layer, the notes say `Needs follow-up review`.

## Auth Model Summary

| Middleware | Behavior | Notes |
| --- | --- | --- |
| `authenticate` | Requires `Authorization: Bearer <jwt>` and verifies it with `env.jwtSecret`. | Sets `req.user` from the token payload. Returns `401` when missing, invalid, or expired. |
| `optionalAuth` | Parses a Bearer token when present, but allows unauthenticated requests. | Invalid tokens are ignored silently. Use with care on order, review, and event routes. |
| `requireRole(...roles)` | Requires an authenticated `req.user.role` to match one of the listed roles. | Returns `401` without auth and `403` for the wrong role. |
| `requirePermission(...permissions)` | Requires authenticated user permissions to include all listed permission ids. | Currently used by `/api/users/*`. |
| Admin bypass | `requirePermission` allows `admin` through regardless of explicit permission list. | This bypass applies only to permission middleware, not `requireRole`. |

## Route Mount Map

| Mount | Router or Handler | Route Family |
| --- | --- | --- |
| `/uploads` | Static files | Public uploaded media. |
| `/api/health` | Inline handler | Public health/status check. |
| `/api/upload` | Inline handler | Seller/admin image upload. |
| `/api/auth` | `authRouter` | Login, register, token refresh, profile, addresses, wishlist, settings, password reset. |
| `/api/crm` | `crmRouter` | CRM customer management. |
| `/api/driver` | `driverRouter` | Driver self-service app endpoints. |
| `/api/drivers` | `driversRouter` | Admin/support driver management and admin driver actions. |
| `/api/support` | `supportRouter` | Authenticated user support tickets. |
| `/api/admin/support` | `adminSupportRouter` | Admin/support support desk operations. |
| `/api/public` | public marketplace, merchandising, and collection routers | Public seller profiles, public merchandising, collections. |
| `/api/events` | `eventsRouter` | Marketplace analytics/events. |
| `/api/admin/merchandising` | admin merchandising routers | Featured sellers/products and curated collections administration. |
| `/api/seller` | `sellerBrandRouter`, `sellerPerformanceRouter` | Seller brand profile and performance summary. |
| `/api/marketplace` | `marketplaceRouter` | Storefront, search, seller operations, admin operations, finance, reviews. |
| `/api/seller-applications` | `sellerApplicationsRouter` | Public seller applications and admin/support review. |
| `/api/orders` | `ordersRouter` | Checkout, order reads, status, support cases, resolution decisions. |
| `/api/notifications` | `notificationsRouter` | Authenticated notification inbox. |
| `/api/users` | `usersRouter` | User and role administration. |
| `/api/sr` | `srRouter` | Sales rep portal. |
| `/api/admin/audit` | `auditRouter` | Audit log. |
| `/api/admin/reports` | `reportsRouter` | Admin reports, reconciliation, commission calculation. |

## Permission Matrix

| Route group | Method/path pattern | Public/private | Required role or permission | Notes/service-level scoping |
| --- | --- | --- | --- | --- |
| Health | `GET /api/health` | Public | None | Exposes environment name, database state, uptime, and version. |
| Static media | `GET /uploads/*` | Public | None | Serves uploaded files directly. Public media exposure policy should be governed by storage/upload rules. |
| Upload | `POST /api/upload` | Private | `seller` or `admin` | Accepts single `image` upload. Storage provider controls final URL. |
| Auth | `POST /api/auth/register` | Public | None | Register schema allows customer/seller registration only. |
| Auth | `POST /api/auth/login` | Public | None | Rate-limited by auth limiter. |
| Auth | `POST /api/auth/refresh` | Public with refresh token | None | Requires refresh token in request body. Refresh token rotation is service-level. |
| Auth | `POST /api/auth/logout` | Private | Any authenticated user | Route does not clear server-side refresh token in the route itself. Needs follow-up review if logout revocation is required. |
| Auth profile | `GET/PATCH /api/auth/me` | Private | Any authenticated user | Own profile by `req.user.sub`. |
| Auth addresses | `POST/PATCH/DELETE /api/auth/me/addresses[...]` | Private | Any authenticated user | Own address book by `req.user.sub`. |
| Auth wishlist/settings | `POST /api/auth/me/wishlist/:productId`, `PATCH /api/auth/me/settings` | Private | Any authenticated user | Own wishlist/settings by `req.user.sub`. |
| Password reset | `POST /api/auth/password-reset/request`, `POST /api/auth/password-reset/confirm` | Public | None | Token-based reset flow. |
| Public storefront | `GET /api/marketplace/storefront` | Public with optional auth | `optionalAuth` | Public storefront data. Product/shop filtering is service-level. |
| Public search | `GET /api/marketplace/search` | Public | None | Public catalog search. Product/shop filtering is service-level. |
| Public seller profiles | `GET /api/public/sellers/:slug`, `GET /api/public/sellers/:slug/products` | Public | None | Public seller profile and live public products. |
| Public merchandising | `GET /api/public/merchandising/featured-sellers`, `GET /api/public/merchandising/featured-products` | Public | None | Public featured placements. Service filters active/public placements. |
| Public collections | `GET /api/public/collections`, `GET /api/public/collections/:slug` | Public | None | Public curated collections. Service filters published/public data. |
| Marketplace events | `POST /api/events/marketplace` | Public with optional auth | `optionalAuth` | Accepts anonymous or authenticated analytics events. |
| Reviews | `POST /api/marketplace/reviews` | Public with optional auth | `optionalAuth` | Needs follow-up review: route allows guest review creation; verified-purchase enforcement is not guaranteed at route level. |
| Orders checkout | `POST /api/orders` | Public with optional auth | `optionalAuth` | Guest checkout supported. Server-side checkout authority is service-level. |
| Orders list | `GET /api/orders` | Private | Any authenticated user | Service scopes customers to own orders and sellers to their shop; admin/support see all. Other authenticated roles need follow-up review. |
| Order detail | `GET /api/orders/:orderId` | Public with optional auth/secret token | `optionalAuth` or guest token | Needs follow-up review: guest access depends on query token; route is intentionally optional-auth and must remain token-safe. |
| Order status | `PATCH /api/orders/:orderId/status` | Private | `seller`, `admin`, `support` | Service validates status transition and seller shop access. |
| Customer order action | `PATCH /api/orders/:orderId/customer-action` | Private | `customer` | Customer accepts/disputes delivered orders. Service-level ownership should be confirmed for every status path. |
| Order support case | `PATCH /api/orders/:orderId/support-case` | Private | `admin`, `support`, `seller` | Service-level access checks and support-case rules apply. |
| Resolution decision | `PATCH /api/orders/:orderId/resolution-decision` | Private | `admin`, `support` | Support can draft/update decisions. |
| Finalize resolution | `POST /api/orders/:orderId/resolution-decision/finalize` | Private | `admin` | Admin-only finalization. |
| Seller dashboard | `GET /api/marketplace/seller` | Private | `seller`, `admin` | Sellers use `req.user.shopId`; admins may query `shopId`. |
| Seller products | `POST /api/marketplace/seller/products` | Private | `seller`, `admin` | Sellers create in own shop; admin may specify `shopId`. |
| Seller product edit | `PATCH /api/marketplace/seller/products/:productId` | Private | `seller`, `admin` | Service should enforce shop ownership. Sensitive edits move product back to approval workflow. |
| Seller stock | `PATCH /api/marketplace/seller/products/:productId/stock`, `PATCH /api/marketplace/seller/products/stock-bulk` | Private | `seller`, `admin` | Service should enforce shop ownership. |
| Seller notices | `PATCH /api/marketplace/seller/notices/:noticeId/action-plan` | Private | `seller` | Seller action plan submission for shop notices. |
| Seller brand profile | `GET/PATCH /api/seller/brand-profile`, `GET /api/seller/brand-profile/preview` | Private | `seller` | Requires linked `req.user.shopId`; service is shop-scoped. |
| Seller performance | `GET /api/seller/performance-summary` | Private | `seller` | Shop-scoped by `req.user.shopId`. |
| Seller drivers | `GET/POST/PATCH /api/marketplace/seller/drivers[...]` | Private | `seller` | Seller-scoped driver management. |
| Seller driver login | `POST /api/marketplace/seller/drivers/:driverId/login` | Private | `seller` | Creates login for seller-managed driver. |
| Seller driver assignment | `POST /api/marketplace/seller/drivers/:driverId/assign/:orderId` | Private | `seller` | Shop-scoped in service. |
| Seller delivery completion | `PATCH /api/marketplace/seller/drivers/:driverId/orders/:orderId/delivery` | Private | `seller` | Seller records seller-driver delivery. Service-level duplicate/COD safety applies. |
| Seller delivery offers | `POST/GET /api/marketplace/seller/delivery-offers`, `GET/PATCH /api/marketplace/seller/delivery-offers/:offerId[...]` | Private | `seller` | Seller-scoped delivery offer management. |
| Seller finance reads | `GET /api/marketplace/seller/balance`, `/seller/transactions`, `/seller/payouts`, `/seller/invoice` | Private | `seller` | Shop-scoped by `req.user.shopId`. Invoice returns CSV. |
| Admin overview | `GET /api/marketplace/admin`, `/admin/analytics/summary`, `/admin/operations/summary`, `/admin/customers` | Private | `admin`, `support` | Support has read visibility on operational/admin dashboard data. |
| Admin sales reps | `GET/POST /api/marketplace/admin/sales-reps` | Private | `admin` | Admin-only sales rep administration. |
| Admin referrals/commissions | `GET /api/marketplace/admin/referrals`, `/admin/commission-entries`, `/admin/commission-plans` | Private | `admin` | Admin-only finance/acquisition views. |
| Admin delivery offers | `GET /api/marketplace/admin/delivery-offers` | Private | `admin` | Admin-only delivery offer overview. |
| Admin product approval | `PATCH /api/marketplace/admin/products/:productId/status` | Private | `admin` | Product workflow transition enforced in service. |
| Admin payment placeholders | `PATCH /api/marketplace/admin/payouts/:payoutId/status`, `/admin/payments/:paymentId/capture` | Private | `admin` | Legacy/in-memory payment helpers. Needs follow-up review before production payment use. |
| Admin COD settlement | `GET /api/marketplace/admin/drivers/:driverId/cod-settlement-candidates`, `POST /api/marketplace/admin/drivers/:driverId/cod-settlements` | Private | `admin` | Driver COD reconciliation. |
| Admin payout management | `GET/POST/PATCH /api/marketplace/admin/payouts[...]`, `GET/POST /api/marketplace/admin/shops/:shopId/*release*` | Private | `admin` | Payout preview, release, creation, status updates. |
| Admin shop rules | `PATCH /api/marketplace/admin/shops/:shopId/payment-rules`, `/contract-status`, `/brand-profile`; `POST /api/marketplace/admin/shops/:shopId/notices` | Private | `admin` | Admin-only shop finance/profile/contract controls. |
| Admin refund | `POST /api/marketplace/admin/orders/:orderId/refund` | Private | `admin` | Performs refund debit and order status update. |
| Driver admin list/read | `GET /api/drivers`, `GET /api/drivers/:id` | Private | `admin`, `support` | Support can read driver list/detail. |
| Driver admin mutate | `POST/PATCH /api/drivers[...]`, `POST /api/drivers/:driverId/assign/:orderId`, `PATCH /api/drivers/:driverId/cod-remit` | Private | `admin` | Admin-only driver management, assignment, COD remittance. |
| Driver delivery by id | `PATCH /api/drivers/:driverId/orders/:orderId/delivery` | Private | `admin`, `driver` | Needs follow-up review: route allows `driver` with path `driverId`; confirm service enforces `req.user.driverId === :driverId`. |
| Driver self profile | `GET /api/driver/me` | Private | `driver` | Requires linked `req.user.driverId`; shop-scoped. |
| Driver deliveries | `GET /api/driver/deliveries`, `GET /api/driver/deliveries/:orderId` | Private | `driver` | Uses `req.user.driverId` and `req.user.shopId`. |
| Driver offers | `GET /api/driver/offers`, `POST /api/driver/offers/:offerId/accept` | Private | `driver` | Uses linked driver/shop identity. |
| Driver pickup/delivery | `PATCH /api/driver/deliveries/:orderId/pickup`, `PATCH /api/driver/deliveries/:orderId/delivery` | Private | `driver` | Uses `req.user.driverId`; delivery path checks task first. |
| Driver history | `GET /api/driver/history` | Private | `driver` | Uses linked driver/shop identity. |
| Support tickets | `POST/GET /api/support/tickets[...]` | Private | Any authenticated user | Service scopes customer/seller/driver/support/admin visibility. Needs follow-up review for every role-specific data boundary after route additions. |
| Admin support tickets | `POST/GET /api/admin/support/tickets[...]` | Private | `admin`, `support` | Shares read/write routes with support plus admin/support-only operations. |
| Admin support operations | `PATCH /api/admin/support/tickets/:ticketId/status`, `/assign`; `POST /internal-notes`, `/convert-dispute` | Private | `admin`, `support` | Support desk workflows. Some operations may have service-level role distinctions. |
| CRM read | `GET /api/crm/customers`, `GET /api/crm/customers/:id` | Private | `admin`, `support` | Router-level admin/support. |
| CRM mutate | `PATCH /api/crm/customers/:id`, `DELETE /api/crm/customers/:id/notes/:noteId` | Private | `admin` | Admin-only update/delete. |
| CRM notes | `POST /api/crm/customers/:id/notes` | Private | `admin`, `support` | Support can add notes. |
| Notifications | `GET /api/notifications`, `/count`; `PATCH /:id/read`, `/read-all` | Private | Any authenticated user | Service filters visibility by user/role/shop. |
| Seller applications | `POST /api/seller-applications` | Public with optional auth | `optionalAuth` plus rate limit | Public seller application submission. |
| Seller applications review | `GET/PATCH /api/seller-applications[...]`, `POST /:id/notes`, `PATCH /:id/checklist` | Private | `admin`, `support` | Support can view/update applications and notes/checklist. |
| Seller applications admin | `DELETE /api/seller-applications/:id/notes/:noteId`, `POST /:id/convert-to-seller` | Private | `admin` | Admin-only note deletion and seller conversion. |
| Users read | `GET /api/users/roles`, `GET /api/users` | Private | `users.read` permission, admin bypass | Support default permissions include `users.read`. |
| Users manage | `POST /api/users`, `PATCH /api/users/:userId`, `PATCH /api/users/:userId/password` | Private | `users.manage` permission, admin bypass | User creation, updates, password resets. |
| Sales rep profile | `GET /api/sr/me` | Private | `sales_rep` | Resolves user to sales rep record. |
| Sales rep referrals/commissions | `GET /api/sr/referrals`, `/commissions`, `/commission-plans` | Private | `sales_rep` | Scoped by rep code in service. |
| Sales rep leads | `GET/POST/PATCH/DELETE /api/sr/leads[...]` | Private | `sales_rep` | Scoped by rep code in service. |
| Sales rep targets | `GET/PUT /api/sr/targets` | Private | `sales_rep` | Needs follow-up review: reps can update targets; confirm whether target ownership should be admin/manager controlled. |
| Sales rep report | `GET /api/sr/report` | Private | `sales_rep` | CSV report scoped by rep code. |
| Admin audit | `GET /api/admin/audit`, `GET /api/admin/audit/export.csv` | Private | `admin` | Role-only admin route; does not use `audit.read` permission. |
| Admin reports | `GET /api/admin/reports/orders`, `/payouts`, `/commissions`, `/reconciliation`, `/summary`; `POST /commissions/run` | Private | `admin` | Admin-only reporting and commission calculation. |
| Admin merchandising read | `GET /api/admin/merchandising/featured-sellers`, `/featured-products`, `/collections`, `/collections/:id`, `/seller-brand-profiles` | Private | `admin`, `support` | Support has read access. |
| Admin merchandising mutate | `POST/PATCH/DELETE /api/admin/merchandising/featured-sellers[...]`, `/featured-products[...]`, `/collections[...]` | Private | `admin` | Admin-only merchandising mutations. |

## Role-Oriented Summary

### Public/Guest

Can use public storefront/search, public seller profile/product pages, public merchandising and collections, seller application submission, marketplace event tracking, auth login/register/refresh/password reset, checkout, and order lookup when a valid guest order token is supplied. Guest order access needs careful token handling because the route is `optionalAuth`.

### Customer

Can manage own auth profile, addresses, wishlist, settings, notifications, own orders, customer delivery actions, and support tickets scoped by requester identity. Review creation is not currently customer-only at route level because `/api/marketplace/reviews` uses `optionalAuth`.

### Seller

Can manage seller dashboard data, products, stock, brand profile, performance summary, seller drivers, delivery offers, seller delivery completion, seller finance reads, invoices, shop notices/action plans, seller-scoped orders, and seller-scoped support tickets. Several seller routes rely on service-level shop ownership checks.

### Driver

Can access `/api/driver/*` self-service routes for profile, deliveries, pickup, delivery completion, offers, and history when `req.user.driverId` is linked. The admin-style `/api/drivers/:driverId/orders/:orderId/delivery` route also allows role `driver` and needs follow-up review for path-driver ownership enforcement.

### Sales Rep

Can access `/api/sr/*` profile, referrals, commissions, commission plans, leads, targets, and CSV report. Most data is scoped by rep code in service logic. Target update ownership needs follow-up review.

### Support/Admin

Support can access CRM reads, support desk routes, seller application review/update, admin operational/analytics reads, admin customer lists, driver read views, merchandising read views, and user read routes through default `users.read` permission. Admin can do all admin-only routes and bypasses `requirePermission`.

### Admin-Only

Admin-only areas include user management with `users.manage`, audit routes, reports, product approvals, payouts, COD settlement, shop payment/contract/profile controls, refunds, driver creation/update/assignment/COD remittance, sales rep administration, seller conversion, and merchandising mutations.

## Follow-Up Review Items

| Item | Why it needs review | Suggested next check |
| --- | --- | --- |
| `/api/drivers/:driverId/orders/:orderId/delivery` driver path ownership | Route allows `admin` and `driver`, but uses `:driverId` from the URL. Do not claim safe until ownership enforcement is confirmed for driver callers. | Add/verify API test where driver A attempts delivery for driver B through this route. |
| `POST /api/marketplace/reviews` uses `optionalAuth` | Guest review creation is allowed at route level. Verified-purchase review enforcement is not guaranteed by the route. | Decide whether reviews must require customer auth and verified delivered order. |
| `GET /api/orders/:orderId` uses `optionalAuth` and guest token | Public-with-secret-token behavior is intentional, but this is sensitive order data. | Verify guest token hashing, response redaction, token expiry/revocation expectations, and brute-force resistance. |
| `GET/PUT /api/sr/targets` is sales-rep owned | Sales reps can update targets through the route. This may conflict with manager/admin-owned target governance. | Confirm target ownership model and whether `PUT /api/sr/targets` should become admin-only or manager-only. |
| Support `audit.read` permission vs audit route role | Support default permissions include `audit.read`, but `/api/admin/audit` uses `requireRole("admin")`, so support cannot use that permission there. | Align permission names with route enforcement or document that audit is admin-only despite support defaults. |
| `GET /api/orders` with non-customer/seller/admin/support roles | Route permits any authenticated user; service filters customer/seller specially and otherwise may return broader data. | Verify behavior for `driver` and `sales_rep` tokens and add role-specific tests. |
| `POST /api/auth/logout` | Route returns success for any authenticated user, but route-level behavior does not prove refresh token revocation. | Confirm service/token revocation expectations and add test if logout should invalidate refresh tokens. |
| Public `/uploads/*` | Static media is public. | Confirm upload validation, file naming, malware scanning expectations, and whether any private media will ever be stored there. |
| Legacy admin payment helpers | `/api/marketplace/admin/payments/:paymentId/capture` and `/admin/payouts/:payoutId/status` appear separate from the newer payout service routes. | Review before production payment launch; avoid relying on legacy/in-memory helpers. |
