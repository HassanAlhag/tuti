# Tuti

Standalone luxury gifting marketplace for perfumes, cakes, desserts, and curated gift boxes.

## Project Structure

```txt
backend/
  src/config          Environment settings
  src/modules         API modules and routes
  src/repositories    Seed fallback repository for demo/support data
  src/seed            Seed data
  src/shared          Shared backend utilities

apps/
  web/                Customer storefront
  seller/             Seller portal
  admin/              Admin operations console

packages/
  shared/             API client, auth store, reusable UI, utilities, styles

docs/
  system-status.md    Living status, known issues, and future enhancements
```

For the latest implementation status, known local issues, and enhancement backlog, see [System Status](./docs/system-status.md).

## What Is Built

- Rich customer storefront with a premium hero slider, perfume/cake/gift-box category pages, product carousels, promo panels, new arrivals, gift guides, occasion shopping, cart, and checkout.
- Separate seller account at `/seller` for shop uploads, inventory, rating visibility, and payout context.
- Separate admin console at `/admin` for approvals, payment ledger, payout controls, and role boundaries.
- Backend API with MongoDB-backed products, shops, reviews, users, and orders, plus seeded demo/support data for promotions, payments, payouts, roles, and audit events.
- Client rating flow that posts to the API and updates product score/review counts dynamically.

## Run Locally

```bash
cd /Users/hassanomer/Projects/Perfume-Marketplace
npm install
npm run dev
```

Customer app: http://localhost:5173, `/shop?c=perfume`, `/shop?c=cake`, `/shop?c=gift_box`, `/cart`, `/collections`, `/shops`, `/about`  
Seller app: http://localhost:5174  
Admin app: http://localhost:5175  
Backend: http://localhost:5055/api/health

## API Endpoints

```txt
GET   /api/marketplace/storefront
GET   /api/marketplace/seller
POST  /api/marketplace/seller/products
POST  /api/marketplace/reviews
GET   /api/marketplace/admin
PATCH /api/marketplace/admin/products/:productId/status
PATCH /api/marketplace/admin/payouts/:payoutId/status
PATCH /api/marketplace/admin/payments/:paymentId/capture

GET   /api/users
GET   /api/users/roles
POST  /api/users
PATCH /api/users/:userId
PATCH /api/users/:userId/password
```

## MongoDB Path

The backend loads `.env` automatically. Set `MONGO_URI` to use MongoDB Atlas or leave it empty to run from in-memory seed data.

On first MongoDB run, the API seeds the starter catalog if collections are empty.

Active collections:

- users
- shops
- products
- reviews
- orders

Still planned as full MongoDB collections:

- payments
- payouts
- disputes
- commissions
- audit_events

## Payment Model

Customer pays, payment is captured, vendor net is held in a payout reserve, delivery starts the reserve window, then admin/rules release payout after refund and dispute checks.
