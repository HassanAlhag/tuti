# Slice 1A — Implementation Summary

Completed: 2026-06-08

---

## Files changed

### Backend

| File | Change |
|---|---|
| `backend/src/models/Order.js` | Added `idempotencyKey` (sparse unique index), `requestFingerprint`, `guestConfirmationToken` (sparse index) fields |
| `backend/src/modules/orders/orders.service.js` | Idempotency key handling; guest token generation (SHA-256 hashed); customer-safe error mapping; `getOrder` guest token validation; `stripInternalOrderFields`; `seedIdempotencyKeys` map; fingerprint computation |
| `backend/src/modules/orders/orders.routes.js` | `GET /:orderId` changed from `authenticate` to `optionalAuth`; guest token extracted from `?token=` query; `Idempotency-Key` header extracted and passed to `createOrder` |

### Frontend

| File | Change |
|---|---|
| `packages/shared/api/client.js` | `ordersApi.create(p, idempotencyKey)` — sends `Idempotency-Key` header; `ordersApi.get(id, guestToken)` — appends `?token=` when provided |
| `apps/web/src/features/pages/sitemap/CartCheckoutPage.jsx` | Idempotency key via `useRef`; navigate to `/orders/:orderId` after success; guest token stored in sessionStorage; `mapCheckoutError` for customer-safe error messages; removed inline orderResult panel |
| `apps/web/src/features/pages/sitemap/OrderConfirmationPage.jsx` | **New file** — persistent order confirmation page; loads by orderId from URL; guest token from sessionStorage; loading/loaded/not-found/unauthorized/error states |
| `apps/web/src/features/pages/SitemapPages.jsx` | Export `OrderConfirmationPage` |
| `apps/web/src/App.jsx` | `/orders/` route added; `OrderConfirmationPage` in pages map; `onNavigate` passed to `CartPage` |
| `apps/web/src/features/pages/sitemap/AccountPage.jsx` | "View full order" button in order detail panel links to `/orders/:orderId` |

### Tests

| File | Tests |
|---|---|
| `backend/src/modules/orders/orders.idempotency.test.js` | 12 new tests — idempotency create/duplicate/conflict, stock deduction once, Build Your Box, guest token |
| `backend/src/modules/orders/orders.access.test.js` | 14 new tests — customer/guest/seller/admin access, not-found, customer-safe errors, refresh-safe GET, configured gift round-trip |

### Documentation

| File | Content |
|---|---|
| `docs/status/purchase-journey-slice-1a/AUDIT.md` | Pre-implementation audit of existing system |
| `docs/status/purchase-journey-slice-1a/IDEMPOTENCY.md` | Idempotency design and limitations |
| `docs/status/purchase-journey-slice-1a/MONGO-STOCK-SAFETY.md` | Stock deduction safety analysis |
| `docs/status/purchase-journey-slice-1a/IMPLEMENTATION.md` | This file |
| `docs/status/purchase-journey-slice-1a/QA-summary.json` | QA results summary |

---

## Outcomes delivered

1. **Persistent order route `/orders/:orderId`** — `OrderConfirmationPage` loads order from backend; refresh-safe; does not depend on component state.
2. **Refresh-safe confirmation** — After checkout, `CartCheckoutPage` navigates to `/orders/:orderId`; browser refresh reloads from API.
3. **Backend idempotency** — `Idempotency-Key` header; fingerprint comparison; MongoDB sparse unique index; seed-mode in-memory map.
4. **MongoDB stock deduction** — Already implemented in `orderStock.js`; confirmed and tested. Customer-safe errors added.
5. **Guest order access** — SHA-256-hashed guest confirmation token; stored in sessionStorage; passed as `?token=` on GET.
6. **Account history links** — "View full order" link in AccountPage detail panel navigates to `/orders/:orderId`.

---

## Remaining limitations

- No MongoDB multi-document transaction wrapping stock deduction + order creation. A process crash between the two operations could leave a decremented stock count without a corresponding order.
- Idempotency keys have no expiry. Long-lived keys would accumulate on the Order collection.
- Guest token is stored in sessionStorage, which does not persist across browser sessions. A guest who closes and reopens the browser cannot access their order via the stored token. The browser Back button from the confirmation page will land on the cart (empty); this is correct behavior.
- No email confirmation is sent to guests with their order reference, so a refreshed browser session loses access. This is a known gap for a future communications slice.
