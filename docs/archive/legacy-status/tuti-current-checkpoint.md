# Tuti Marketplace — Operational Core + Seller Growth + Merchandising + Analytics Foundation

## Overall Status

This repository is at a stable development checkpoint, not a final production release.

The core marketplace flows, seller growth surfaces, merchandising foundation, and the first read-only analytics/event-tracking layers are implemented and have passed the latest QA and build checks. The system is in a good place to continue into premium storefront polish and broader analytics work without reopening the foundational marketplace pieces.

## Completed Modules

- Customer storefront
- Seller portal
- Admin operations console
- Driver portal
- Order lifecycle
- Delivery assignment and delivery offers
- COD collection and reconciliation
- Seller balance ledger
- Payout management
- Support tickets
- Dispute conversion and resolution
- Admin operations dashboard
- Seller brand profiles
- Public seller brand pages
- Featured sellers
- Homepage featured perfume houses rail
- Featured products
- Homepage featured product rails
- Curated collections backend/admin/public page
- Seller performance analytics
- Event tracking backend
- Web page-view tracking
- Homepage placement impressions/clicks

## Stable QA Notes

- Latest builds passed.
- Event tracking homepage placement tracking is functionally stable.
- The UI remains stable when the tracking endpoint fails.
- Known caveat: browser devtools can show network failure messages if the tracking endpoint is intentionally forced to fail.

## Known Risks / Pending Items

- Event rollups into seller analytics
- Collection item click tracking
- Generic product card click tracking
- Add-to-cart tracking later
- MongoDB transaction hardening for the finance ledger
- Event data retention policy
- Product quality score
- Seller improvement recommendations
- Public storefront premium polish
- Support attachments / SLA tools
- Admin finance exception dashboard
- Paid boosts much later

## Protected Areas

These files and modules should not be casually changed without targeted tests and a clear reason.

### Backend

- `backend/src/modules/orders/orders.service.js`
- `backend/src/modules/drivers/drivers.service.js`
- `backend/src/modules/finance/sellerBalance.js`
- `backend/src/modules/finance/payoutService.js`
- `backend/src/modules/support/support.service.js`
- `backend/src/modules/marketplace/events.service.js`
- `backend/src/modules/marketplace/seller-performance.service.js`
- `backend/src/modules/marketplace/collections.service.js`
- `backend/src/modules/marketplace/featured-products.service.js`
- `backend/src/modules/marketplace/featured-sellers.service.js`

### Frontend

- `apps/admin/src/features/shell/AdminConsole.jsx`
- `apps/seller/src/features/shell/SellerPortal.jsx`
- `apps/seller/src/features/shell/SellerLayout.jsx`
- `apps/web/src/features/pages/HomePage.jsx`
- `apps/web/src/features/tracking/marketplaceTracking.js`
- `packages/shared/api/client.js`

### CSS

- `apps/admin/src/styles/admin-dashboard.css`
- `apps/seller/src/styles/seller.css`
- `apps/web/src/styles/client.css`

## Recommended Completion Roadmap

### Stage 1: Stabilization and documentation
Lock the current marketplace baseline, preserve the stable checkpoints, and document the major flows and protected modules.

### Stage 2: Premium customer storefront polish
Improve the public customer experience with premium visuals, luxury pacing, and stronger product presentation.

### Stage 3: Event tracking completion and rollups
Add the remaining engagement events, then roll them up into seller-facing and admin-facing analytics.

### Stage 4: Product quality score and seller recommendations
Introduce a quality signal for products and practical seller improvement guidance.

### Stage 5: Operations enhancements
Expand operational tooling where it helps support, finance, disputes, and fulfillment work faster.

### Stage 6: Production hardening
Focus on transaction safety, retention policy, observability, and release readiness.

### Stage 7: Paid boosts and seller promotion later
Consider paid promotion and seller-initiated merchandising only after the editorial and analytics foundations are stable.

## Next Immediate Step

The next immediate product work is:

**Premium Customer Storefront v1 Audit and Redesign Plan**

