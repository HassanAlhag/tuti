# MVP Launch Boundary

Source: `docs/bmad-system-review.md`  
Status: planning draft  
Date: 2026-06-12

## Launch thesis

The MVP is a COD-first premium gifting marketplace where a customer can discover live products, build a coordinated perfume plus sweet gift, place a safe COD order, have a seller fulfill it, have a driver deliver it, and have admin/support reconcile settlement, disputes, and seller payout expectations.

The MVP is not a complete payment platform, a full CMS, a native mobile product, or an automated payout network. It is the smallest credible launch version of Tuti where purchase integrity, seller fulfillment, delivery handoff, COD settlement, support/dispute handling, and premium gifting trust are production-safe.

## MVP principles

- Backend authority wins over client state for price, stock, product status, shop attribution, fees, payment state, and delivery settlement.
- COD is the only enabled payment method until a real card authorization gateway exists.
- The premium gifting promise centers on coordinated boutique gifts, especially Build Your Box.
- Seller and driver operations must be simple, auditable, and reversible by admin/support.
- Seller balances and payouts must be ledger-backed and reconciled before money movement.
- Seed/demo behavior must be impossible in production.
- Every launch-critical flow must have automated or manual UAT coverage with clear pass/fail evidence.

## Included in MVP

### Customer storefront and discovery

- Public storefront with only live, approved products and eligible public seller data.
- Category discovery for perfumes, cakes, desserts, gift boxes, bundles, and Build Your Box.
- Product detail pages with seller context, product facts, gift-relevant metadata, and add-to-cart.
- Seller brand pages for approved/published sellers.
- Curated collections sufficient for premium gifting discovery.
- Basic search/filter behavior suitable for launch catalog size.

### Premium gifting

- Build Your Box as the flagship gift flow.
- Same-boutique pairing of one perfume plus one cake/dessert.
- Gift message, allergy note, gift-wrap or Tuti-presentation metadata.
- Cart and checkout display of configured gift contents.
- Order confirmation display of Build Your Box contents.
- Seller order view that clearly exposes gift configuration and handling notes.

### Cart and checkout

- Client-side cart is acceptable for MVP only because the backend revalidates and reprices.
- Checkout accepts product IDs, quantities, and permitted gift configuration.
- Backend loads products, validates status/stock/shop/category, recalculates subtotal, platform fee, vendor net, and order item snapshots.
- COD checkout only.
- API rejects card checkout until a real gateway integration is implemented.
- Idempotent order creation prevents duplicate orders on retry.
- Guest checkout and account checkout are both supported.
- Guest confirmation is durable enough for launch, either through retained token links or email confirmation links.

### Order lifecycle

- Order states support Pending, Confirmed, Processing, Ready for Delivery, Shipped, Delivered, Customer Accepted, Disputed, Cancelled, and Refunded where applicable.
- Sellers can view and progress only their own shop orders.
- Customers can view their own account orders.
- Guests can access their order through a secure token.
- Delivered orders can be accepted or disputed by customers.
- Status history is preserved for customer, seller, admin, and support visibility.

### Seller fulfillment

- Seller registration or application flow sufficient for controlled launch.
- Admin review/approval of sellers and products.
- Seller product creation, editing, status submission, and stock updates.
- Sensitive product edits route back through approval.
- Seller order management for fulfillment states.
- Seller driver management for controlled seller delivery.
- Seller support access for order issues and disputes.

### Driver delivery

- Seller/admin driver creation and assignment.
- Delivery offer acceptance where used.
- Driver pickup confirmation.
- Driver delivery completion.
- Proof-of-delivery field persistence.
- COD collected amount capture.
- Driver COD balance and settlement candidate visibility.
- Consistent delivery completion behavior across seller, driver, and admin paths.

### Admin settlement and operations

- Admin product approval and catalog oversight.
- Admin order visibility and operational status controls.
- Admin driver oversight and COD settlement.
- Admin seller balance visibility.
- Admin-controlled payout records.
- Admin audit log for sensitive operations.
- Admin support/dispute tooling.
- Basic reports needed for COD, payout, commission, and reconciliation review.

### Support and disputes

- Customer/seller/driver support ticket creation and scoped access.
- Order-linked support cases.
- Conversion of support tickets into disputes.
- Customer dispute action on delivered orders.
- Seller balance freeze/release behavior for disputes.
- Admin/support resolution decisions with notes and auditability.

### Payout expectations

- MVP supports calculated seller balances and admin-controlled payout records.
- MVP does not automatically disburse money to bank accounts.
- Seller balance must distinguish pending, held, available, payout, COD, dispute, refund, and adjustment events.
- COD seller credit occurs only after admin settlement of collected cash.
- Non-COD seller credit remains disabled or controlled until card payments exist.
- Payout status changes are admin-controlled and auditable.

### Authentication and roles

- Customer, seller, admin, support, driver, and sales rep roles remain distinct.
- Role-based API access is enforced server-side.
- Refresh token rotation works reliably.
- Production sessions do not rely on seed/demo login behavior.
- Admin/demo login shortcuts are not exposed in production.

## Excluded from MVP

- Card payments, unless a real payment gateway authorization/capture/refund lifecycle is integrated.
- Apple Pay, Google Pay, BNPL, wallets, saved cards, and subscriptions.
- Automated bank payout disbursement.
- Seller self-service payout requests unless explicitly scoped later.
- Native iOS or Android apps.
- Real-time driver GPS tracking or customer map tracking.
- Multi-country launch, multi-currency, VAT automation, and cross-border delivery.
- Advanced recommendation engine or AI scent matching.
- Full CMS for journal/offers/gifting content.
- Account-synced carts and abandoned-cart automation.
- Loyalty points, gift cards, memberships, and coupons beyond controlled admin merchandising.
- Warehouse inventory, purchase orders, or ERP integrations.
- Public API for external partners.
- Full sales rep compensation automation beyond tracked commission entries and admin review.

## Launch blockers

- Normal checkout items are not server-repriced.
- Card checkout can create payment authorization state without a gateway.
- Production can run without Mongo and fall into seed/demo behavior.
- Driver delivery completion can fail because of the undefined `safeShopId` path.
- Public storefront can expose non-live products.
- Refresh token rotation can break user sessions.
- Proof-of-delivery and pickup fields are not consistently persisted.
- Finance reconciliation is not covered by launch-grade tests.

## Launch success metrics

- COD checkout success rate meets target for launch cohort.
- Zero accepted orders with tampered price, shop ID, or non-live products.
- Seller can process orders from creation through Ready for Delivery without admin intervention.
- Driver can complete delivery and COD capture without backend error.
- Admin can settle COD and see seller balance movement.
- Customer can accept or dispute delivered orders.
- Support can resolve disputes with balance hold/release evidence.
- No production environment can start with seed/demo auth enabled.
- Critical flow automated smoke suite passes in CI.

## Counter-metrics

- Orders created with client-modified prices.
- Orders created for draft/rejected/out-of-stock products.
- Driver delivery completion returning 500 after mutation.
- COD collected without settlement trail.
- Seller payout state changing without ledger evidence.
- Public API returning draft or rejected products.
- Refresh token failures after first rotation.
- Production health endpoint reporting seed-memory database.

## Open questions

- What exact geographic launch boundary is intended for the first production cohort?
- Are sellers contractually responsible for delivery, or will Tuti operate platform drivers for launch?
- What is the exact payout hold period and dispute window for COD orders?
- Should guest order links expire, and if so after how many days?
- Which seller onboarding documents are required before approval?
- What support SLA is promised to customers and sellers during MVP?

