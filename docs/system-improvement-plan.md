# Tuti System — Improvement Roadmap

Created: 2026-06-08  
Scope: Complete platform — customer web, seller, admin, driver, SR, backend

This roadmap is sequenced by dependencies. Each phase builds on the previous. Do not start Phase N+1 until Phase N acceptance criteria are met.

---

## Phase 0 — Repository and Documentation Control

**Objective:** Establish a reliable foundation before building anything new.

**Complexity:** Small

**Modules:**
- Version control
- Backup workflow
- Documentation structure
- Environment files
- Seed data repeatability
- Build and test baseline

**Technical tasks:**
- Initialize a Git repository; establish a branching convention (main, feature/*, hotfix/*)
- Add `.gitignore` to exclude `node_modules`, `.env`, `dist`, `*.local`
- Create a one-command seed reset (`npm run seed:reset`) that works repeatably
- Consolidate environment variable documentation in `.env.example` files
- Document which `.env` files are required per app
- Ensure `npm run build` and `node --test` are part of a pre-commit or CI check

**QA tasks:**
- All 5 apps build after git init
- All backend tests pass after git init
- `npm run dev` starts all apps cleanly from a fresh clone

**Acceptance criteria:**
- `git log` shows initial commit with all source files tracked
- `npm install && npm run build` passes on a clean machine
- `node --test` passes with 116 tests minimum
- Backup/restore procedure documented

**Dependencies:** None (must be first)

**Recommended sequence:** Do this before any new feature work.

---

## Phase 1 — Customer Purchase Journey

**Objective:** Customers can complete a full COD purchase, get a persistent confirmation, and find their order later.

**Complexity:** Large

**Modules:**
- Checkout
- Order confirmation
- Cart (server-side)
- Duplicate-submit protection
- Configured gift rendering
- Guest vs authenticated checkout
- Mobile and accessibility

**Technical tasks:**
- ✅ Add `/orders/:id` route to web app with persistent order detail page (Slice 1A)
- ✅ Fix "no order confirmation after page refresh" (Slice 1A)
- ✅ Add duplicate-submit protection at checkout — idempotency key on POST /api/orders (Slice 1A)
- ✅ Guest checkout persistence via secure confirmation token (Slice 1A)
- Connect authenticated checkout to real MongoDB order; verify order is retrievable from `/account`
- Add mobile layout pass for CartPage and checkout flow
- Add ARIA labels and keyboard navigation to cart and checkout forms

**UX tasks:**
- Confirmation page: order ID, items, total, payment method, delivery estimate, tracking link placeholder
- Error recovery: clear error message if checkout fails with retry option

**QA tasks:**
- Complete checkout creates an order visible in `/account`
- Refreshing `/orders/:id` shows the same order
- Double-click submit does not create duplicate orders
- Guest checkout creates order without requiring account
- Mobile: full checkout flow on 375px screen

**Acceptance criteria:**
- Customer can complete COD checkout and see confirmation at `/orders/:id`
- Order is retrievable from `/account` for authenticated customers
- Duplicate orders cannot be created by double-click

**Dependencies:** Phase 0 (Git, tests baseline)

---

## Phase 2 — Customer Account

**Objective:** Customers have a complete self-service account.

**Complexity:** Medium

**Modules:**
- Profile management
- Address book
- Order history and detail
- Delivery tracking
- Saved items / wishlist
- Customer notifications
- Account settings

**Technical tasks:**
- Add profile edit endpoint (`PATCH /api/auth/me`) for name, phone, email
- Add address CRUD endpoints and frontend address book
- Add password reset flow (email token → reset form)
- Add saved items / wishlist model and API endpoint
- Add deep-link navigation from notification bell to the specific record
- Add account settings (notification preferences, communication opt-in)
- Link delivery tracking status to order status transitions

**QA tasks:**
- Profile edit saves and reloads correctly
- Address added, edited, deleted without affecting order history
- Password reset completes without login

**Acceptance criteria:**
- Customer can view/edit profile, manage addresses, see all orders, save items
- Password reset works end-to-end via email

**Dependencies:** Phase 1

---

## Phase 3 — Public Marketing and Content

**Objective:** All public editorial pages are content-ready.

**Complexity:** Medium

**Modules:**
- Sell on Tuti page
- Our Story / About page
- Gifting editorial
- Journal / blog
- Offers
- Collections (admin-curated)
- Support and FAQ
- Legal consistency
- SEO and metadata

**Technical tasks:**
- Add `<meta>` tags and Open Graph data to all public routes
- Add canonical URL handling
- Add a basic journal content structure (Markdown or CMS stub)
- Add an application form to the Sell on Tuti page (`POST /api/seller-applications`)
- Flesh out Gifting page with real category-filtered product sections
- Populate Offers page from a real promotions API or admin-managed entries

**UX tasks:**
- Consistent page headers and introduction copy across all editorial pages
- Responsive layout pass for all static pages at 375px and 1440px
- Legal pages: consistent structure across privacy, terms, returns, cookies

**SEO tasks:**
- Page titles and meta descriptions for all public routes
- Structured data (JSON-LD) for products and seller brand pages
- Sitemap.xml and robots.txt

**Acceptance criteria:**
- All public pages render well-formed content with titles and meta tags
- Sell on Tuti form submits to backend and creates a seller application record

**Dependencies:** Phase 1

---

## Phase 4 — Unified Authentication and Portal Routing

**Objective:** One login entry point with automatic role detection and portal redirect.

**Complexity:** Medium

**Modules:**
- Shared login page
- Role detection
- Portal URL routing
- Unauthorized role handling
- Session security

**Technical tasks:**
- Create a shared login page at a known URL (e.g., `login.tuti.ae`) or add a role-detection gateway
- After login, server returns role; client redirects to the appropriate portal URL
- Handle "already authenticated as wrong role" gracefully (show role mismatch error, not silent failure)
- Add JWT rotation on sensitive actions (password change)
- Add 15-minute idle timeout for seller, admin, driver, SR portals
- Add `SameSite=Strict` cookie option (if moving from localStorage to httpOnly cookies)

**QA tasks:**
- Customer login stays on customer site
- Seller login redirects to seller portal
- Admin login redirects to admin console
- Driver login redirects to driver portal
- SR login redirects to SR portal
- Wrong-role attempt shows clear message

**Acceptance criteria:**
- One login entry point works for all five roles
- Role mismatch shows a clear, safe error

**Dependencies:** Phase 0

---

## Phase 5 — Seller Experience

**Objective:** Sellers have complete tools to list, sell, and manage their business.

**Complexity:** Large

**Modules:**
- Seller onboarding wizard
- Product creation and editing
- Image management
- Inventory management
- Order preparation and handoff
- Delivery offer management
- Payouts (display)
- Analytics (seller-scoped)
- Mobile responsiveness

**Technical tasks:**
- Add structured seller onboarding wizard (business info, product categories, first product)
- Add image upload to S3/R2 and replace local filesystem storage
- Add product edit endpoint with image replacement
- Add inventory bulk adjustment endpoint
- Add seller-scoped analytics API (orders, GMV, top products per period)
- Add seller notification bell for driver events (offer accepted, delivered)
- Add mobile-responsive layout pass for seller portal

**UX tasks:**
- Onboarding wizard with progress indicator
- Product card preview in creation form
- Analytics charts (line/bar) for GMV and order trends

**QA tasks:**
- New seller can onboard, create product, receive first order
- Image uploaded to S3 survives server restart
- Seller analytics show real data from past 30 days

**Acceptance criteria:**
- Seller can onboard, list products, fulfill orders, and see their payout balance
- All images stored in object storage, not local filesystem

**Dependencies:** Phase 1 (order flow), Phase 3 (Sell on Tuti page)

---

## Phase 6 — Admin Experience

**Objective:** Admins have complete operational visibility and controls.

**Complexity:** Large

**Modules:**
- Operational dashboard with live KPIs
- User/seller approvals
- Merchandising (featured sellers, products, collections)
- Orders and logistics
- Finance center
- Support queue
- Audit log (durable)
- Roles / permissions (backend-enforced)
- System configuration

**Technical tasks:**
- Add durable audit event stream to MongoDB (admin actions, seller actions, order events)
- Implement fine-grained RBAC policies in backend middleware (not just client-side checks)
- Add financial report export (CSV/PDF) for orders, payouts, commissions
- Add admin notification for new seller applications, new disputes, and failed deliveries
- Add operational dashboard with real KPIs (GMV today, orders today, active disputes, payout queue)

**QA tasks:**
- Admin creates featured placement → visible on homepage within 1 minute
- Admin approves seller → seller can log in and list products
- Audit log records admin actions correctly

**Acceptance criteria:**
- Admin can approve sellers, manage orders, and view financial summary in one session
- Audit log is queryable and exportable

**Dependencies:** Phase 5 (seller experience must be stable)

---

## Phase 7 — Driver Experience

**Objective:** Drivers have a complete, mobile-optimized delivery workflow.

**Complexity:** Medium

**Modules:**
- Delivery offer push notifications
- Assignment flow
- Pickup confirmation
- Delivery proof (photo)
- COD reconciliation
- Dispute handling
- History
- Mobile UX

**Technical tasks:**
- Add push notifications to driver portal (WebSocket or web push API) for new offers
- Add pickup confirmation step (`PATCH /api/orders/:id/status` → `Shipped`)
- Add proof-of-delivery photo upload
- Add COD reconciliation screen showing outstanding cash per session
- Add delivery history with date filters
- Mobile layout pass: all driver screens optimized for 375px

**QA tasks:**
- Driver receives push notification when seller broadcasts offer
- Driver can accept offer, mark pickup, mark delivered, and attach proof
- COD balance reflects correct amount

**Acceptance criteria:**
- Driver workflow is fully mobile-native
- Proof of delivery is stored and visible to seller and admin

**Dependencies:** Phase 5 (seller broadcasts offers)

---

## Phase 8 — Sales Representative Experience

**Objective:** SRs have complete acquisition and performance tools.

**Complexity:** Medium

**Modules:**
- Lead / seller acquisition pipeline
- Follow-up reminders
- Assigned accounts
- Commissions
- Targets
- Reports
- Mobile UX

**Technical tasks:**
- Add prospect / lead model (pre-seller, not yet registered)
- Add follow-up reminder system (scheduled reminders with due date)
- Add SR performance targets (monthly GMV target, referral target)
- Add commission calculation cron that runs nightly
- Add SR report export (referrals, GMV, commissions per period)
- Mobile layout pass for SR portal

**QA tasks:**
- SR adds a lead, sets a follow-up, lead converts to seller → referral linked
- Commission entries appear after first sale

**Acceptance criteria:**
- SR can manage a full acquisition pipeline from lead to active seller
- Commission ledger reflects correct amounts within 24 hours of order

**Dependencies:** Phase 6 (admin can manage SRs)

---

## Phase 9 — Financial and Operational Completion

**Objective:** Platform finances are accurate, traceable, and transferable.

**Complexity:** Large

**Modules:**
- Commission calculation and automation
- Seller payouts (real disbursement)
- COD settlement
- Refunds (real payment reversal)
- Disputes with payment side effects
- Invoices
- Reconciliation
- Financial reporting

**Technical tasks:**
- Integrate a payment gateway (Stripe, Checkout.com, Tap Payments, etc.)
- Add card payment capture flow
- Add real payout disbursement (bank transfer or gateway payout)
- Add COD settlement flow (driver remits cash → admin confirms → seller balance credited)
- Add refund API endpoint that reverses payment and updates order status
- Add invoice generation for sellers (PDF via template)
- Add nightly reconciliation job

**QA tasks:**
- Card payment captured without double-charge
- Payout disbursement triggers bank transfer
- COD settlement clears driver COD balance and credits seller
- Refund reverses payment and updates order status to Refunded

**Acceptance criteria:**
- End-to-end money flow works: customer pays → seller credited → seller paid out
- COD settlement and refunds leave zero unreconciled balances

**Dependencies:** Phase 7 (COD collection complete), Phase 8 (commission calculation complete)

---

## Phase 10 — Production Readiness

**Objective:** Platform is secure, reliable, tested, and deployable.

**Complexity:** Large

**Modules:**
- Automated testing
- Security review
- Load testing
- Backups
- Monitoring
- Logging
- S3 / media
- Email / SMS / notifications
- SEO
- Accessibility
- Privacy
- Deployment
- UAT
- Launch checklist

**Technical tasks:**
- Add E2E tests with Playwright for critical customer flows (checkout, account, product)
- Add API integration tests for all order and payment endpoints
- Security audit: OWASP Top 10, JWT storage, CORS, rate limiting
- Load test: target 100 concurrent users, no 500 errors
- Add structured logging (Winston or Pino) with request IDs
- Add error monitoring (Sentry or equivalent)
- Add uptime monitoring for API and all portals
- Complete S3 migration for all uploads
- Add email service (SendGrid, Mailgun, or Resend) for transactional emails
- Add WhatsApp/SMS for order status notifications (UAE market expectation)
- Full accessibility audit (WCAG 2.1 AA)
- Privacy policy and cookie consent implementation
- Deployment pipeline (CI/CD via GitHub Actions or equivalent)
- Docker Compose update for production topology
- SSL certificates and domain configuration
- Internal UAT with stakeholders covering all user roles
- Go-live checklist signed off

**QA tasks:**
- All Playwright tests pass
- No OWASP Top 10 vulnerabilities
- Load test passes at 100 concurrent users
- Accessibility audit: 0 critical issues

**Acceptance criteria:**
- Platform is deployed to production infrastructure
- All critical flows tested and signed off by stakeholders
- Monitoring, logging, and alerting are active
- Launch checklist fully completed

**Dependencies:** All previous phases

---

## Recommended Sequence

```
Phase 0 (Repository) → Phase 1 (Customer journey) → Phase 4 (Auth)
                                ↓
                        Phase 2 (Customer account)
                        Phase 3 (Editorial pages)
                                ↓
                        Phase 5 (Seller experience)
                                ↓
                        Phase 6 (Admin experience)
                        Phase 7 (Driver experience)
                        Phase 8 (SR experience)
                                ↓
                        Phase 9 (Finance)
                                ↓
                        Phase 10 (Production readiness)
```

Phases 2, 3, 4 can run in parallel after Phase 1.
Phases 6, 7, 8 can run in parallel after Phase 5.
Phase 9 requires Phases 7 and 8.
Phase 10 requires all previous phases.
