# Tuti System Status

Last updated: 2026-06-11 (Phase 0 Git init complete)

---

## 1. Executive Summary

| Area | Completion |
|---|---|
| Customer experience (browse, cart, checkout) | ~70% |
| Customer account (orders, profile, tracking) | ~40% |
| Public editorial pages | ~55% |
| Seller portal | ~60% |
| Admin console | ~55% |
| Driver portal | ~80% |
| Sales Rep portal | ~70% |
| Backend / API | ~65% |
| Production readiness | ~20% |
| **Overall platform** | **~55%** |

**Top five technical risks before soft launch:**

1. ~~No reliable version control~~ **RESOLVED (Phase 0)** — Git initialized; `main` branch established; 293 files in initial commit
2. No production file storage — uploads are local filesystem; images are lost on server restart and cannot be served in production
3. ~~No persistent order confirmation~~ **RESOLVED (Slice 1A)** — `/orders/:orderId` route with `OrderConfirmationPage`; refresh-safe; backend-loaded
4. ~~Mongo Build a Box nested stock deduction not implemented~~ **RESOLVED (Slice 1A)** — already implemented in `orderStock.js`; confirmed and tested
5. ~~No duplicate-submit protection at checkout~~ **RESOLVED (Slice 1A)** — idempotency key (header + sparse unique index); button disabled during submission

**Separate business decisions (not classified as technical blockers):**

- Cash on delivery is the operational payment method; it works end-to-end
- Online card payment is intentionally disabled; whether it is required for launch is a business decision
- No payout disbursement; whether auto-payout is required for launch is a business decision

---

## 2. Application Inventory

| Application | Package | Location | Dev URL | Purpose | Status |
|---|---|---|---|---|---|
| Customer Web | `@tuti/web` | `apps/web/` | `http://localhost:5173` | Customer storefront | Active |
| Seller Portal | `@tuti/seller` | `apps/seller/` | `http://localhost:5174` | Seller dashboard | Active |
| Admin Console | `@tuti/admin` | `apps/admin/` | `http://localhost:5175` | Operations & admin | Active |
| Driver Portal | `@tuti/driver` | `apps/driver/` | `http://localhost:5176` | Delivery tasks | Active |
| SR Portal | `@tuti/sr` | `apps/sr/` | `http://localhost:5177` | Sales rep dashboard | Active |
| Backend API | `@tuti/backend` | `backend/` | `http://localhost:5055/api` | Express REST API | Active |
| Shared | `@tuti/shared` | `packages/shared/` | — | Auth, API client, UI primitives | Active |

---

## 3. Customer Website Status

| Module | Route | Status | Accepted | Known Gaps | Priority |
|---|---|---|---|---|---|
| Homepage | `/` | Working | Yes | Image optimization; no skeleton loading | Low |
| Immersive story | Embedded in `/` | Working | Yes | None | — |
| Navigation (desktop) | Layout | Working | Yes | None | — |
| Mobile drawer | Layout | Working | Yes | None | — |
| Footer | Layout | Working | Yes | None | — |
| Shop / catalogue | `/shop` | Working | Yes | No server-side filtering; no pagination | Low |
| Category listing | `/shop?c=*` | Working | Yes | Same as Shop | Low |
| Product cards | Shop / Homepage | Working | Yes | None | — |
| Product detail | `/products/:id` | Working | Partial | No standalone route review page; review form is basic | Medium |
| Build a Box | `/build-a-box` | Working | Yes | Same-shop only; no Mongo nested stock | Low |
| Seller directory | `/shops` | Working | Yes | No search or filtering | Medium |
| Seller brand pages | `/sellers/:slug` | Working | Yes | No reviews section | Medium |
| Collections | `/collections` | Working | Partial | Admin-created only; empty state in dev | Low |
| Collection detail | `/collections/:slug` | Working | Partial | Same as above | Low |
| Find a Scent | `/fragrance-finder` | Working | Partial | No saved preferences; no quiz backend | Medium |
| Cart | `/cart` | Working | Partial | Design review pending; functional COD checkout present | Medium |
| Checkout | `/cart` (inline) | Working | Partial | Idempotency key added; navigates to `/orders/:id` on success | High |
| Order confirmation | `/orders/:orderId` | Working | Partial | Persistent route; refresh-safe; guest token support. Browser QA pending | High |
| Customer account | `/account` | Working | Partial | Orders list + detail work; no profile edit, addresses, wishlist | High |
| Offers | `/offers` | Working | Partial | Static layout; no real promotion backend | Medium |
| Gifting | `/gifting` | Working | Partial | Static editorial; no personalisation | Low |
| Journal | `/journal` | Working | Partial | Static placeholder; no CMS | Low |
| Our Story / About | `/about` | Working | Partial | Static placeholder | Low |
| Sell on Tuti | `/sell` | Working | Partial | Static landing page; no application form backend | Medium |
| Support tickets | `/support` | Working | Partial | Ticket creation works; no real-time updates | Medium |
| Customer service | `/customer-service` | Working | Partial | Static page | Low |
| Store locator | `/store-locator` | Working | Partial | Static placeholder | Low |
| Legal | `/legal` | Working | Partial | Static placeholder | Low |
| Auth modal | Overlay | Working | Yes | No password reset | High |

### Cart and Checkout — Current Implementation Detail

`CartPage` re-exports `CartCheckoutPage` from `SitemapPages.jsx`. This is the actual implementation:

- **Cart items:** Standard products and configured Build a Box items. Each cart row has a `cartLineId` for stable line identity. Standard products merge by product ID; configured gifts always get a separate line (`separateLine: true`).
- **Optional item metadata:** Cake writing, allergy notes, gift wrap, and item messages are captured per line at checkout.
- **Checkout mode:** Detects authenticated vs guest; defaults to authenticated mode when logged in.
- **Payment method:** COD is the operational default. Card payment option is visible in the UI but disabled — routes to a "coming soon" state. No real payment capture occurs.
- **Order creation:** `POST /api/orders` with full cart payload. Order result stored in `orderResult` component state. Cart is cleared on success.
- **Inline confirmation:** After success, an order confirmation panel renders inline on the same `/cart` page showing order ID, status, payment status, customer info, items, and total. This panel is not a separate route.
- **Confirmation persistence gap:** `orderResult` is React component state only. If the customer navigates away, refreshes, or closes the tab, the confirmation is gone. There is no `/orders/:id` route.
- **Configured gift display:** Build a Box items show the selected perfume name and treat name in the cart and in the checkout confirmation.

**Design status:** The CartCheckoutPage is functional but has not had a dedicated design review pass. It is not in the frozen/accepted list.

---

## 4. Seller System Status

| Module | Status | Known Gaps |
|---|---|---|
| Login | Working | No password reset; no 2FA |
| Overview dashboard | Working | Data is live; no trend charts |
| Product listing | Working | No bulk ops; no inventory bulk edit |
| Product creation | Working | Image upload is local-only |
| Product editing | Working | No image replacement flow |
| Stock / inventory | Working | Manual adjustments only |
| Order list | Working | Filters work; no export |
| Order detail | Working | Status actions work |
| Drivers (add, enable login) | Working | No driver notifications |
| Payout view | Working | Payout disbursement not implemented |
| Analytics | Working (basic) | Not backed by full reporting pipeline |
| Brand profile | Working | No logo upload flow documented |
| Notifications | Working | Bell, read, mark-all-read |
| Support tickets | Working | Same as driver/SR support |
| Onboarding | Missing | No structured onboarding wizard |
| Bank detail / KYC | Missing | Payment gateway not integrated |

---

## 5. Admin System Status

| Module | Status | Known Gaps |
|---|---|---|
| Login | Working | Admin-only role check |
| Dashboard overview | Working | Seed/live data |
| Users list | Working | Create, edit, role assign |
| Sellers list | Working | Approve, suspend, terminate, health score |
| Seller pipeline | Working | Referral status |
| Orders | Working | Status actions, filters |
| Drivers | Working | Seller-owned and platform drivers, COD monitoring |
| Merchandising | Working | Featured sellers, featured products, collections |
| Payments center | Working | Payout status actions; no real gateway |
| Support queue | Working | Dispute resolution actions |
| Sales Reps | Working | List, view |
| Audit log | Working | UI only; not a durable event stream |
| Role matrix | Working | UI only; no backend policy enforcement |
| Operations dashboard | Working | Live summary stats |
| Analytics | Working (basic) | Not backed by full event pipeline |
| Reports | Missing | No export, no financial reports |

---

## 6. Driver System Status

| Module | Status | Known Gaps |
|---|---|---|
| Login | Working | Seller-assigned credentials only |
| Delivery list | Working | Assigned by seller |
| Delivery detail | Working | Address, items, COD amount |
| Accept delivery offer | Working | First-accepted wins |
| Mark delivered | Working | COD toggle + note |
| COD balance | Working | Cash tracking only; no transfer |
| Support tickets | Working | Create, filter, reply |
| Notifications | Missing | No push / bell in driver portal |
| Real-time tracking | Missing | No GPS or live location |
| Proof of delivery | Missing | No photo upload |
| Route optimization | Missing | Out of scope for MVP |

---

## 7. Sales Representative System Status

| Module | Status | Known Gaps |
|---|---|---|
| Login | Working | SR role; demo credentials in UI |
| Overview | Working | Stats: referrals, GMV, commissions |
| Referral list | Working | Status, GMV, dates |
| Commission ledger | Working | Entry-level view; no breakdown |
| Commission plans | Working | Plans displayed from constants |
| Support tickets | Working | Create, filter, reply |
| Lead/acquisition pipeline | Missing | No prospecting or CRM tools |
| Follow-up reminders | Missing | Not implemented |
| Mobile responsiveness | Partial | Layout works; not optimized for mobile-first |

---

## 8. Backend and Data Status

| Area | Status | Known Gaps |
|---|---|---|
| Authentication (JWT) | Working | Access + refresh tokens; no password reset endpoint |
| Roles / permissions | Working | Middleware-enforced; no fine-grained RBAC UI |
| Database (MongoDB) | Working | Optional; falls back to in-memory seed |
| Products | Working | CRUD, approval workflow, stock |
| Orders | Working | COD checkout, status machine, Build Your Box |
| Carts | Client-only | Cart state is in Zustand + localStorage; no server cart |
| Configured gifts | Working | Build Your Box validation + seed stock deduction |
| Delivery / drivers | Working | Assign, offers, mark delivered, COD |
| Notifications | Working | In-app bell; no email/SMS/push |
| Uploads | Working | Multer, 5MB limit; local filesystem only |
| Tracking / analytics | Working | Page views, placement events; no aggregation pipeline |
| Payments | Stub only | COD tracking; no gateway integration |
| Payouts | Stub only | Status updates; no disbursement |
| Sales Rep commissions | Working | Foundation ledger; no automated calculation cron |
| Support / disputes | Working | Ticket lifecycle, resolution; no payment side effects |
| Seller health score | Client utility | No backend recalculation automation |
| Rate limiting | Working | Global + auth-specific limits |
| Security headers | Working | Helmet |
| Background jobs | Missing | No queue system |
| API documentation | Missing | No Swagger / OpenAPI spec |
| Backups | Manual archive only | No automated backup |

### Active MongoDB Models

User, Shop, Product, Review, Order, Notification, SupportTicket, SalesRep, Driver, SellerApplication, SellerBrandProfile, SellerReferral, SellerTransaction, CommissionEntry, DeliveryOffer, Payout, CuratedCollection, FeaturedProductPlacement, FeaturedSellerPlacement, MarketplaceEvent

---

## 9. Cross-System Workflows

### 1. Customer Order

| Step | App | Status |
|---|---|---|
| Browse → add to cart | Web | Working |
| COD checkout | Web → Backend | Working |
| Order created | Backend | Working |
| Seller notified | Backend → Notifications | Working |
| Seller prepares → ships | Seller | Working |
| Driver assigned | Seller or Admin | Working |
| Driver delivers | Driver | Working |
| Customer accepts | Web | Working |
| Payout triggered | Backend | Stub only |

**Missing:** Payment gateway, real payout transfer, order confirmation route

### 2. Build a Box Order

Same as customer order but:
- Configuration validated at order creation
- Two stock lines deducted (seed mode working; Mongo deferred)
- Same-shop rule enforced

### 3. Seller Fulfillment

Seller portal order → mark preparing → mark shipped → driver assigned → delivered. Works end-to-end.

### 4. Delivery Offer and Driver Assignment

Seller broadcasts offer → Driver accepts → Assignment created → Driver marks delivered → COD balance updated. Working. No push notifications to driver yet.

### 5. COD Collection

Driver marks `codCollected: true` → driver COD balance incremented. Seller visibility in Admin. No settlement transfer implemented.

### 6. Seller Payout

Admin can set payout status. No real disbursement. Commission calculation foundation exists but no cron.

### 7. Refund / Dispute

Customer disputes order → Support ticket + dispute flag created → Admin resolves → Resolution visible to customer and seller. No actual payment reversal or refund transfer.

### 8. Seller Onboarding

Seller can register, submit products, get approval. No structured onboarding wizard, KYC, or bank verification.

### 9. Sales Rep Acquisition

SR shares rep code → Seller signs up with code → Referral linked → Commission entries created at first sale and GMV milestones. Foundation works; no acquisition tools or follow-up tracking.

### 10. Customer Support

Customer files ticket at `/support` → Admin sees it in support queue → Admin actions: reviewing, contact, escalate, add note, resolve → Resolution visible to customer. No email notification sent.

---

## 10. Authentication and Role Routing

| Role | Login URL | After Login |
|---|---|---|
| Customer | `/` (auth modal) | Stays on customer site |
| Seller | `apps/seller` (http://localhost:5174) | Seller dashboard |
| Admin | `apps/admin` (http://localhost:5175) | Admin console |
| Driver | `apps/driver` (http://localhost:5176) | Driver deliveries |
| Sales Rep | `apps/sr` (http://localhost:5177) | SR overview |

**Token storage:** JWT in Zustand store (localStorage via persist)  
**Shared auth:** `@tuti/shared/store/authStore.js` used by all portals  
**Gap:** Each portal has a separate login; no single unified login entry point  
**Gap:** Portal URLs are environment-variable driven; cross-portal links work only when env vars are set

---

## 11. Design and UX Status

**ACCEPTED / FROZEN — do not redesign without a new approved change request:**

| Feature | Notes |
|---|---|
| Homepage | Immersive story + 7 commerce sections |
| Shop / catalogue | Category grid with product cards |
| Product cards | Perfume, Cake, Gift Box variants |
| Product detail | Standard layout with reviews |
| Build a Box | Guided 3-step builder |
| Seller brand pages | Public brand profile with product grid |
| Collection pages | Curated product grid |

**PENDING — design not locked:**

| Feature | Status |
|---|---|
| Cart / Checkout | Functional but not design-reviewed |
| Customer account | Functional but minimal styling |
| Sell on Tuti | Static placeholder |
| Our Story / About | Static placeholder |
| Gifting editorial | Static placeholder |
| Journal | Static placeholder |
| Offers | Static placeholder |
| All role dashboards | Functional-first, not brand-polished |

---

## 12. Testing Status

### Build Commands

```bash
npm run build                         # All five apps
npm run build -w @tuti/web            # Web only
npm run build -w @tuti/seller         # Seller only
npm run build -w @tuti/admin          # Admin only
npm run build -w @tuti/driver         # Driver only
npm run build -w @tuti/sr             # SR only
```

### Test Commands

```bash
node --test backend/src/modules/orders/*.test.js backend/src/shared/workflows/*.test.js backend/src/modules/finance/*.test.js
```

### Current Build Status

All five apps: **PASS** (verified 2026-06-08)

### Current Test Status

142/142 backend tests: **PASS** (verified 2026-06-08, Slice 1A added 26 new tests)

### Automated Test Coverage

**Backend unit tests — committed and repeatable:**
- `backend/src/modules/orders/` — Build Your Box validation, stock deduction — 14 tests
- `backend/src/shared/workflows/` — Order and product state machines — ~60 tests
- `backend/src/modules/finance/` — COD settlement, commission reversal, payout, seller balance — ~42 tests
- Total: 116 tests, all invoked via `node --test`

**Frontend unit tests:** None committed.

**API integration tests:** None committed.

**Committed repeatable Playwright/E2E suite:** None. No `playwright.config.js` or E2E test source files exist in the repository.

**One-off Playwright browser QA (not committed, not repeatable):** Extensive visual QA sessions were performed during the homepage, Shop, and Build a Box milestones. Screenshots are preserved in `docs/milestones/` milestone files. These are evidence of past QA, not a repeatable test suite.

**Manual UAT:** MVP operations flows verified manually per `docs/manual-uat-script.md`.

### Highest-Risk Untested Flows (no automated coverage)

1. Checkout → order creation → stock deduction (MongoDB mode)
2. Driver assignment → COD collection → seller balance update
3. Dispute creation → admin resolution → customer visibility
4. Seller onboarding → product approval → storefront visibility
5. Notification delivery across role boundaries
6. Build a Box nested stock deduction in MongoDB mode

---

## 13. Environment and Deployment

### Required Environment Variables

| Variable | Purpose | Required |
|---|---|---|
| `PORT` | Backend port (default `5055`) | Optional |
| `MONGO_URI` | MongoDB connection; empty = in-memory seed | Optional |
| `CLIENT_ORIGIN` | Main frontend origin for CORS | Production required |
| `CLIENT_ORIGINS` | Comma-separated CORS allowlist for all portals | Production required |
| `JWT_SECRET` | Access token signing secret | Required |
| `JWT_REFRESH_SECRET` | Refresh token signing secret | Required |
| `VITE_API_URL` | Frontend API base URL (default `http://localhost:5055/api`) | Production required |
| `VITE_SELLER_URL` | Seller portal URL for cross-portal link | Production required |
| `VITE_DRIVER_URL` | Driver portal URL for cross-portal link | Production required |
| `VITE_SR_URL` | SR portal URL for cross-portal link | Production required |

### Environment Files

| File | Status |
|---|---|
| `.env` | Root — loaded by backend; contains local dev secrets |
| `.env.example` | Root — documents expected variables; safe to commit |
| `apps/web/.env` | Web Vite env; contains `VITE_API_URL` |
| `apps/web/.env.local` | Web local overrides |
| `apps/web/.env.development.local` | Web dev overrides |
| `apps/web/.env.example` | Web example; safe to commit |

### Local Dev

```bash
npm install
npm run dev          # All apps in parallel
npm run kill         # Kill stale port processes
```

### Local Ports

| App | Port |
|---|---|
| Web | 5173 |
| Seller | 5174 |
| Admin | 5175 |
| Driver | 5176 |
| SR | 5177 |
| Backend | 5055 |

### Production Configuration Gaps

- No CI/CD pipeline
- No deployment scripts
- File uploads are local filesystem; production needs S3 / R2
- No Docker Compose update for current `apps/*` structure
- No SSL / reverse proxy configuration documented
- No backup automation

### Version Control

Git initialized (2026-06-11). Branch: `main`. Convention: `feature/*`, `hotfix/*`. Backup archive still available: `/private/tmp/tuti-backup-20260608-160219.tar.gz`

---

## 14. Known Issues

| ID | Area | Issue | Severity | User Impact | Proposed Fix |
|---|---|---|---|---|---|
| KI-001 | Checkout | ~~No order confirmation route~~ **RESOLVED** | High | `/orders/:orderId` added; refresh-safe | Slice 1A |
| KI-002 | Orders | ~~Duplicate-submit protection absent~~ **RESOLVED** | High | Idempotency key header + sparse unique index | Slice 1A |
| KI-003 | Uploads | Local filesystem only | High | Images lost on server restart in production | S3 / R2 integration |
| KI-004 | Auth | No password reset | High | Customers/sellers cannot self-serve reset | Email-based reset flow |
| KI-005 | Backend | ~~No Git version control~~ **RESOLVED** | High | Git initialized; `main` branch; conventional commits | Phase 0 |
| KI-006 | Cart | Cart state is client-only | Medium | Cart lost on different device / browser | Server-side cart session |
| KI-007 | Notifications | Bell only; no email/SMS | Medium | Users miss events when not logged in | Email/WhatsApp notification channel |
| KI-008 | Orders | ~~Mongo nested stock deduction not implemented~~ **RESOLVED** | Medium | Already implemented; confirmed and tested in Slice 1A | Slice 1A |
| KI-009 | Driver | No push notifications | Medium | Driver misses new offers | WebSocket or push channel |
| KI-010 | Admin | Audit log is not a durable stream | Low | Compliance gap | Durable event log table |
| KI-011 | API | No Swagger/OpenAPI documentation | Low | Integration friction | Add API docs |
| KI-012 | Dev | Port collisions require manual kill | Low | Developer friction | Supervisor / PM2 for dev |

---

## 15. Frozen Milestones

The following features are accepted and must not be redesigned without a new approved change request:

- Homepage (immersive story + 7 commerce sections)
- Shop / catalogue page and product cards
- Product detail page
- Build a Box builder and cart contract
- Seller brand pages
- Collection pages
- Navigation header and mobile drawer
- Footer (4-column sitemap layout)

See `docs/milestones/` for individual milestone files.

---

## 16. Completed Milestone

**Phase 1, Slice 1A — Persistent and Safe Order Completion** — COMPLETE (2026-06-08)

All scope items delivered. See `docs/status/purchase-journey-slice-1a/` for full details.

**Next milestone:** Phase 1, Slice 1B — Cart and Checkout UX pass

---

## Run Commands

```bash
# Dev
npm install
npm run dev

# Individual apps
npm run dev:backend
npm run dev:web
npm run dev:seller
npm run dev:admin
npm run dev:driver

# Build
npm run build
npm run build:web

# Tests
node --test backend/src/modules/orders/*.test.js backend/src/shared/workflows/*.test.js backend/src/modules/finance/*.test.js

# Kill stale ports
npm run kill
```

## Current API Surface

See individual routes files in `backend/src/modules/*/` for authoritative route listings.

Key endpoints:

- `GET /api/health`
- `POST /api/auth/login` / `register` / `refresh` / `logout`
- `GET /api/auth/me`
- `GET /api/marketplace/storefront`
- `GET /api/marketplace/featured-sellers`
- `GET /api/marketplace/featured-products`
- `POST /api/marketplace/reviews`
- `GET|POST /api/orders`
- `GET /api/orders/:orderId` (optionalAuth; guest token via `?token=`)
- `PATCH /api/orders/:id/status`
- `GET|POST /api/notifications`
- `PATCH /api/notifications/:id/read`
- `GET|POST /api/support`
- `POST /api/upload`
